import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { can } from "@/lib/roles";
import { applyHandling } from "@/lib/order-handling";

export const runtime = "nodejs";

// Marks a paid order as "verwerkt" and/or (pickup orders) "staat klaar". Internal only: it
// never changes OrderStatus, so no customer mail goes out. /api is outside proxy.ts, so the
// session is checked here.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!can(admin.role, "orders", "write")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const candidate = (typeof body === "object" && body !== null ? body : {}) as { processed?: unknown; readyForPickup?: unknown };
  for (const value of [candidate.processed, candidate.readyForPickup]) {
    if (value !== undefined && typeof value !== "boolean") return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const input = { processed: candidate.processed as boolean | undefined, readyForPickup: candidate.readyForPickup as boolean | undefined };

  const pick = { id: true, status: true, isTest: true, deliveryMethod: true, processedAt: true, processedByName: true, readyForPickupAt: true, readyForPickupByName: true } as const;
  const existing = await prisma.order.findUnique({ where: { id }, select: pick });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const result = applyHandling(existing, input, admin.name, new Date());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "NO_FIELDS" ? 400 : 409 });
  if (Object.keys(result.data).length === 0) return NextResponse.json({ order: existing });

  const updated = await prisma.$transaction(async (tx) => {
    // Guard on the status we just read, so a refund or cancellation in between wins.
    const { count } = await tx.order.updateMany({ where: { id, status: existing.status }, data: result.data });
    if (count !== 1) return null;
    const after = await tx.order.findUniqueOrThrow({ where: { id }, select: pick });
    await recordAudit(tx, admin, "OrderHandling", id, "UPDATE", existing, after);
    return after;
  });
  if (!updated) {
    return NextResponse.json({ error: "ORDER_CHANGED", message: "De bestelling is intussen gewijzigd. Herlaad de pagina." }, { status: 409 });
  }
  return NextResponse.json({ order: updated });
}
