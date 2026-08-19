import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import {
  prepareAftersalesEvent,
  processAftersalesDelivery,
  queueAftersalesEvent,
} from "@/lib/aftersales/service";
import { aftersalesTriggerForOrderTransition } from "@/lib/aftersales/events";
import {
  isAllowedAdminOrderTransition,
  requiresTrackingForFulfillment,
} from "@/lib/aftersales/order-state";

// proxy.ts's matcher explicitly excludes /api/** ("/((?!api|_next|.*\\..*).*)"),
// so unlike the /admin/** page tree this route is NOT gated by the shared
// admin session check in proxy.ts — it must verify the session itself.
const VALID_STATUSES = new Set<string>(Object.values(OrderStatus));

type PatchBody = Partial<{
  postnlTrackingCode: unknown;
  status: unknown;
}>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await verifyAdminSessionToken(token))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const candidate = body as PatchBody;
  const data: { postnlTrackingCode?: string | null; status?: OrderStatus } = {};

  if (candidate.postnlTrackingCode !== undefined) {
    if (candidate.postnlTrackingCode !== null && typeof candidate.postnlTrackingCode !== "string") {
      return NextResponse.json({ error: "INVALID_TRACKING_CODE" }, { status: 400 });
    }
    const trimmed =
      typeof candidate.postnlTrackingCode === "string" ? candidate.postnlTrackingCode.trim() : "";
    data.postnlTrackingCode = trimmed.length > 0 ? trimmed : null;
  }

  if (candidate.status !== undefined) {
    if (typeof candidate.status !== "string" || !VALID_STATUSES.has(candidate.status)) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }
    data.status = candidate.status as OrderStatus;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (
    existing.isTest &&
    ((data.postnlTrackingCode !== undefined && data.postnlTrackingCode !== null) ||
      data.status === "FULFILLED")
  ) {
    return NextResponse.json({ error: "TEST_ORDER_NOT_SHIPPABLE" }, { status: 409 });
  }
  if (
    data.status === "CANCELLED" &&
    (existing.status === "PAID" || existing.status === "FULFILLED")
  ) {
    return NextResponse.json({ error: "PAID_ORDER_REQUIRES_REFUND" }, { status: 409 });
  }
  if (data.status && !isAllowedAdminOrderTransition(existing.status, data.status)) {
    return NextResponse.json(
      {
        error: "INVALID_STATUS_TRANSITION",
        from: existing.status,
        to: data.status,
      },
      { status: 409 }
    );
  }
  if (
    (data.status ?? existing.status) === "FULFILLED" &&
    requiresTrackingForFulfillment(existing.deliveryMethod)
  ) {
    const effectiveTrackingCode =
      data.postnlTrackingCode !== undefined
        ? data.postnlTrackingCode
        : existing.postnlTrackingCode;
    if (!effectiveTrackingCode) {
      return NextResponse.json(
        {
          error: "TRACKING_CODE_REQUIRED",
          message: "Een verzendbestelling kan niet zonder trackingcode worden verzonden.",
        },
        { status: 409 }
      );
    }
  }

  const trigger = data.status
    ? aftersalesTriggerForOrderTransition(existing.status, data.status, existing.isTest)
    : null;
  const prepared = trigger ? await prepareAftersalesEvent(trigger) : null;

  try {
    const transition = await prisma.$transaction(async (transaction) => {
      const { count } = await transaction.order.updateMany({
        where: { id, status: existing.status, updatedAt: existing.updatedAt },
        data,
      });
      if (count !== 1) throw new Error("ORDER_CHANGED");

      const queued =
        trigger && prepared
          ? await queueAftersalesEvent(transaction, id, trigger, prepared)
          : null;
      const updated = await transaction.order.findUniqueOrThrow({ where: { id } });
      return { queued, updated };
    });

    let aftersalesStatus: string | null = null;
    if (trigger) {
      if (!transition.queued) {
        aftersalesStatus = "disabled";
      } else {
        const result = await processAftersalesDelivery(transition.queued.deliveryId).catch(
          (error) => {
            console.error("Failed to process queued order aftersales event", {
              orderId: transition.updated.id,
              trigger,
              error,
            });
            return { status: "failed" as const };
          }
        );
        aftersalesStatus = result.status;
      }
    }

    return NextResponse.json({ order: transition.updated, aftersalesStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_CHANGED") {
      return NextResponse.json(
        {
          error: "ORDER_CHANGED",
          message: "De bestelling is intussen gewijzigd. Herlaad de pagina en probeer opnieuw.",
        },
        { status: 409 }
      );
    }
    console.error("Failed to update order", { orderId: id, error });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
