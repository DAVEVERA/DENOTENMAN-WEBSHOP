import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { recordBusinessEvent, sendBusinessOrderListChangedEmail } from "@/lib/business-portal";
import { businessOrderListItemInputSchema, resolveBusinessOrderListItems } from "@/lib/business-order-list-items";

const inputSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  validUntil: z.string().datetime().nullable().optional(),
  items: z.array(businessOrderListItemInputSchema).min(1).max(200),
}).strict();

const EDITABLE_STATUSES = new Set(["DRAFT", "SENT"]);

class VersionConflictError extends Error {}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; orderListId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });

  const { id, orderListId } = await context.params;
  const existing = await prisma.businessOrderList.findFirst({
    where: { id: orderListId, businessAccountId: id },
    include: { businessAccount: true, items: { select: { id: true } } },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // PAID and CANCELLED lists are frozen: a paid list must match the invoice
  // exactly, and a cancelled one has no reason to change. CHANGES_REQUESTED
  // and APPROVED are legacy customer-approval states we no longer produce,
  // but existing rows in those states stay editable via the same DRAFT/SENT
  // path once touched, since there is no meaningful distinction left now
  // that the customer can no longer act on them.
  if (!EDITABLE_STATUSES.has(existing.status) && existing.status !== "CHANGES_REQUESTED" && existing.status !== "APPROVED") {
    return NextResponse.json({ error: "INVALID_STATUS_TRANSITION" }, { status: 409 });
  }
  if (existing.version !== parsed.data.version) {
    return NextResponse.json({ error: "VERSION_CONFLICT" }, { status: 409 });
  }

  // A checkout attempt is in flight for this list: editing now could let the
  // customer pay an amount that no longer matches what Fedor is changing it
  // to. Wait for that payment to reach a terminal state first.
  const pendingOrder = await prisma.order.findFirst({
    where: { businessOrderListId: orderListId, status: "PENDING" },
    select: { id: true },
  });
  if (pendingOrder) {
    return NextResponse.json({ error: "CHECKOUT_IN_PROGRESS" }, { status: 409 });
  }

  const validUntil = parsed.data.validUntil !== undefined
    ? (parsed.data.validUntil ? new Date(parsed.data.validUntil) : null)
    : existing.validUntil;
  if (validUntil && validUntil.getTime() <= Date.now()) {
    return NextResponse.json({ error: "VALID_UNTIL_IN_PAST" }, { status: 400 });
  }

  const resolved = await resolveBusinessOrderListItems(parsed.data.items);
  if (!resolved.ok) {
    const status = resolved.error === "VARIANT_NOT_AVAILABLE" ? 409 : 400;
    return NextResponse.json({ error: resolved.error }, { status });
  }

  const wasAlreadySent = existing.status === "SENT";

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.businessOrderList.updateMany({
        where: { id: orderListId, businessAccountId: id, version: existing.version },
        data: {
          title: parsed.data.title ?? existing.title,
          validUntil,
          totalCents: resolved.totalCents,
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) throw new VersionConflictError();

      // Update-in-place for lines the client identified as existing (keeps
      // their createdAt, which the customer portal uses to tell genuinely
      // new items from ones that were merely re-saved), create the rest,
      // and delete whatever existing line isn't present in this save.
      const existingIds = new Set(existing.items.map((item) => item.id));
      const keptIds = new Set<string>();
      for (const [index, item] of resolved.items.entries()) {
        const { existingId, ...data } = item;
        if (existingId && existingIds.has(existingId)) {
          keptIds.add(existingId);
          await tx.businessOrderListItem.update({
            where: { id: existingId },
            data: { ...data, sortOrder: index },
          });
        } else {
          await tx.businessOrderListItem.create({
            data: { orderListId, ...data, sortOrder: index },
          });
        }
      }
      const removedIds = [...existingIds].filter((itemId) => !keptIds.has(itemId));
      if (removedIds.length > 0) {
        await tx.businessOrderListItem.deleteMany({ where: { id: { in: removedIds } } });
      }

      const orderList = await tx.businessOrderList.findUniqueOrThrow({
        where: { id: orderListId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      await recordBusinessEvent(tx, {
        businessAccountId: id,
        orderListId,
        type: "ORDER_LIST_ITEMS_UPDATED",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: `Bestellijst “${orderList.title}” bewerkt`,
      });
      await recordAudit(tx, admin, "BusinessOrderList", orderListId, "UPDATE", existing, orderList);
      return orderList;
    });

    let emailWarning: string | undefined;
    if (wasAlreadySent) {
      try {
        await sendBusinessOrderListChangedEmail({
          orderListId,
          version: updated.version,
          title: updated.title,
          items: updated.items,
          totalCents: updated.totalCents,
          account: existing.businessAccount,
        });
      } catch (error) {
        console.error("Business order-list changed email failed", { orderListId, error });
        emailWarning = "ORDER_LIST_CHANGED_EMAIL_FAILED";
      }
    }

    return NextResponse.json({ ok: true, orderList: updated, wasAlreadySent, warning: emailWarning });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json({ error: "VERSION_CONFLICT" }, { status: 409 });
    }
    throw error;
  }
}
