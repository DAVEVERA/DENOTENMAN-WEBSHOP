import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession, recordBusinessEvent } from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";
import {
  businessOrderListIsExpired,
  calculateBusinessOrderListTotal,
  customerCanEditBusinessOrderList,
} from "@/lib/business-portal-contract";

const quantitySchema = z.object({
  action: z.literal("UPDATE_QUANTITIES"),
  version: z.number().int().min(1),
  items: z.array(z.object({ id: z.string().min(1).max(100), quantity: z.number().int().min(1).max(100_000) })).min(1).max(200),
}).strict();
const noteSchema = z.object({ action: z.literal("ADD_NOTE"), text: z.string().trim().min(1).max(4000) }).strict();
const decisionSchema = z.object({ action: z.enum(["APPROVE", "REQUEST_CHANGES"]), version: z.number().int().min(1) }).strict();
const schema = z.discriminatedUnion("action", [quantitySchema, noteSchema, decisionSchema]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  const orderList = await prisma.businessOrderList.findFirst({
    where: { id, businessAccountId: session.businessAccountId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!orderList) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (businessOrderListIsExpired(orderList.validUntil)) {
    return NextResponse.json({ error: "ORDER_LIST_EXPIRED" }, { status: 410 });
  }
  if (!customerCanEditBusinessOrderList(orderList.status)) {
    return NextResponse.json({ error: "ORDER_LIST_LOCKED" }, { status: 409 });
  }
  if (orderList.deliveryStatus === "SENDING") {
    return NextResponse.json({ error: "ORDER_LIST_DELIVERY_IN_PROGRESS" }, { status: 409 });
  }

  try {
    if (parsed.data.action === "ADD_NOTE") {
      const noteText = parsed.data.text;
      await prisma.$transaction(async (tx) => {
        const now = new Date();
        const claimed = await tx.businessOrderList.updateMany({
          where: {
            id,
            businessAccountId: session.businessAccountId,
            status: { in: ["SENT", "CHANGES_REQUESTED"] },
            deliveryStatus: { not: "SENDING" },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          },
          data: { updatedAt: now },
        });
        if (claimed.count !== 1) {
          await throwCustomerMutationConflict(tx, id, session.businessAccountId, now, false);
        }
        await tx.businessOrderListNote.create({
          data: { orderListId: id, actorType: "CUSTOMER", authorName: session.businessAccount.contactName, text: noteText },
        });
        await recordBusinessEvent(tx, {
          businessAccountId: session.businessAccountId,
          orderListId: id,
          type: "ORDER_LIST_NOTE_ADDED",
          actorType: "CUSTOMER",
          actorName: session.businessAccount.contactName,
          summary: `${session.businessAccount.contactName} heeft een notitie achtergelaten bij “${orderList.title}”`,
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.version !== orderList.version) {
      return NextResponse.json({ error: "VERSION_CONFLICT" }, { status: 409 });
    }

    if (parsed.data.action === "UPDATE_QUANTITIES") {
      const requestedItems = parsed.data.items;
      const expectedIds = new Set(orderList.items.map((item) => item.id));
      if (requestedItems.length !== expectedIds.size || requestedItems.some((item) => !expectedIds.has(item.id))) {
        return NextResponse.json({ error: "ITEM_SET_MISMATCH" }, { status: 400 });
      }
      const quantities = new Map(requestedItems.map((item) => [item.id, item.quantity]));
      let totalCents: number;
      try {
        totalCents = calculateBusinessOrderListTotal(orderList.items.map((item) => ({ quantity: quantities.get(item.id)!, unitPriceCents: item.unitPriceCents })));
      } catch {
        return NextResponse.json({ error: "TOTAL_OUT_OF_RANGE" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const now = new Date();
        const claimed = await tx.businessOrderList.updateMany({
          where: {
            id,
            businessAccountId: session.businessAccountId,
            version: orderList.version,
            status: { in: ["SENT", "CHANGES_REQUESTED"] },
            deliveryStatus: { not: "SENDING" },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          },
          data: { totalCents, status: "CHANGES_REQUESTED", version: { increment: 1 } },
        });
        if (claimed.count !== 1) {
          await throwCustomerMutationConflict(tx, id, session.businessAccountId, now, true);
        }
        await Promise.all(requestedItems.map((item) => tx.businessOrderListItem.update({ where: { id: item.id }, data: { quantity: item.quantity } })));
        await recordBusinessEvent(tx, {
          businessAccountId: session.businessAccountId,
          orderListId: id,
          type: "ORDER_LIST_QUANTITIES_CHANGED",
          actorType: "CUSTOMER",
          actorName: session.businessAccount.contactName,
          summary: `${session.businessAccount.contactName} heeft aantallen aangepast in “${orderList.title}”`,
          metadata: { before: orderList.items.map((item) => ({ id: item.id, quantity: item.quantity })), after: requestedItems },
        });
      });
      return NextResponse.json({ ok: true });
    }

    const approved = parsed.data.action === "APPROVE";
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.businessOrderList.updateMany({
        where: {
          id,
          businessAccountId: session.businessAccountId,
          version: orderList.version,
          status: { in: ["SENT", "CHANGES_REQUESTED"] },
          deliveryStatus: { not: "SENDING" },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        data: approved
          ? { status: "APPROVED", approvedAt: now, version: { increment: 1 } }
          : { status: "CHANGES_REQUESTED", version: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        await throwCustomerMutationConflict(tx, id, session.businessAccountId, now, true);
      }
      await recordBusinessEvent(tx, {
        businessAccountId: session.businessAccountId,
        orderListId: id,
        type: approved ? "ORDER_LIST_APPROVED" : "ORDER_LIST_CHANGES_REQUESTED",
        actorType: "CUSTOMER",
        actorName: session.businessAccount.contactName,
        summary: approved
          ? `${session.businessAccount.contactName} heeft “${orderList.title}” goedgekeurd`
          : `${session.businessAccount.contactName} vraagt wijzigingen voor “${orderList.title}”`,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BusinessPortalErrorForRoute) {
      return NextResponse.json({ error: error.code }, { status: error.code === "ORDER_LIST_EXPIRED" ? 410 : 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "VERSION_CONFLICT" }, { status: 409 });
    }
    console.error("Business customer order-list mutation failed", { id, error });
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
}

class BusinessPortalErrorForRoute extends Error {
  constructor(public readonly code: string) { super(code); }
}

async function throwCustomerMutationConflict(
  tx: Prisma.TransactionClient,
  id: string,
  businessAccountId: string,
  now: Date,
  versioned: boolean
): Promise<never> {
  const current = await tx.businessOrderList.findFirst({
    where: { id, businessAccountId },
    select: { status: true, version: true, validUntil: true, deliveryStatus: true },
  });
  if (current && businessOrderListIsExpired(current.validUntil, now)) {
    throw new BusinessPortalErrorForRoute("ORDER_LIST_EXPIRED");
  }
  if (!current || !customerCanEditBusinessOrderList(current.status)) {
    throw new BusinessPortalErrorForRoute("ORDER_LIST_LOCKED");
  }
  if (current.deliveryStatus === "SENDING") {
    throw new BusinessPortalErrorForRoute("ORDER_LIST_DELIVERY_IN_PROGRESS");
  }
  throw new BusinessPortalErrorForRoute(versioned ? "VERSION_CONFLICT" : "ORDER_LIST_LOCKED");
}
