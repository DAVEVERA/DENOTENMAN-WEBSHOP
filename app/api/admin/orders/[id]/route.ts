import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";

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
  if (!(await isValidAdminSessionToken(token))) {
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

  const updated = await prisma.order.update({
    where: { id },
    data,
  });

  return NextResponse.json({ order: updated });
}
