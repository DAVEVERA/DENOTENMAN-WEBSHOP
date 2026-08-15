import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";
import { PostnlError } from "@/lib/postnl";
import { ensurePostnlLabel, PostnlLabelGuardError } from "@/lib/postnl-labels";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return isValidAdminSessionToken(token);
}

// Only these statuses represent something actually worth shipping.
const SHIPPABLE_STATUSES = ["PAID", "FULFILLED"] as const;

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const candidate = body as Partial<{ from: unknown; to: unknown }>;
  const fromRaw = typeof candidate.from === "string" ? candidate.from : null;
  const toRaw = typeof candidate.to === "string" ? candidate.to : null;

  if (!fromRaw || !toRaw) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const from = new Date(fromRaw);
  // Inclusive end of day for the "to" date, since it's picked as a plain date.
  const to = new Date(toRaw);
  to.setHours(23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "INVALID_DATES" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      isTest: false,
      createdAt: { gte: from, lte: to },
      status: { in: [...SHIPPABLE_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "NO_ORDERS" }, { status: 404 });
  }

  const failed: { orderId: string; message: string }[] = [];
  const labelBase64ByOrder: { orderId: string; labelBase64: string }[] = [];

  for (const order of orders) {
    try {
      const label = await ensurePostnlLabel(order.id);
      labelBase64ByOrder.push({ orderId: order.id, labelBase64: label.labelBase64 });
    } catch (error) {
      failed.push({
        orderId: order.id,
        message:
          error instanceof PostnlError || error instanceof PostnlLabelGuardError
            ? error.message
            : "Onbekende fout",
      });
    }
  }

  if (labelBase64ByOrder.length === 0) {
    return NextResponse.json(
      { error: "ALL_FAILED", failed },
      { status: 502 }
    );
  }

  const merged = await PDFDocument.create();
  for (const { labelBase64 } of labelBase64ByOrder) {
    const source = await PDFDocument.load(Buffer.from(labelBase64, "base64"));
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  const mergedBytes = await merged.save();

  return new NextResponse(Buffer.from(mergedBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="verzendlabels-${fromRaw}-${toRaw}.pdf"`,
      "X-Labels-Included": String(labelBase64ByOrder.length),
      "X-Labels-Failed": String(failed.length),
      "X-Labels-Failed-Detail": encodeURIComponent(JSON.stringify(failed)),
    },
  });
}
