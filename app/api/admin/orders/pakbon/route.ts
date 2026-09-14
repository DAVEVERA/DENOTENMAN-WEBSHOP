import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { parseAmsterdamCalendarDay } from "@/lib/amsterdam-calendar";
import { renderPackingSlipPdfBase64 } from "@/lib/packing-slip-pdf";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return (await verifyAdminSessionToken(token)) !== null;
}

// Only these statuses represent something actually worth packing.
const SHIPPABLE_STATUSES = ["PAID", "FULFILLED"] as const;
const MAX_ORDERS_PER_BATCH = 20;
const RENDER_CONCURRENCY = 4;

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
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

  const from = parseAmsterdamCalendarDay(fromRaw, false);
  const to = parseAmsterdamCalendarDay(toRaw, true);
  if (!from || !to || from.getTime() > to.getTime()) {
    return NextResponse.json({ error: "INVALID_DATES" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      isTest: false,
      createdAt: { gte: from, lte: to },
      status: { in: [...SHIPPABLE_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
    take: MAX_ORDERS_PER_BATCH + 1,
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "NO_ORDERS" }, { status: 404 });
  }
  if (orders.length > MAX_ORDERS_PER_BATCH) {
    return NextResponse.json(
      { error: "BATCH_TOO_LARGE", maxOrders: MAX_ORDERS_PER_BATCH, message: "Kies een kleiner datumbereik en maak maximaal 20 pakbonnen per batch." },
      { status: 413 }
    );
  }

  const limit = pLimit(RENDER_CONCURRENCY);
  const pdfBase64ByOrder = await Promise.all(
    orders.map((order) =>
      limit(() =>
        renderPackingSlipPdfBase64({
          orderId: order.id,
          createdAt: order.createdAt,
          contactName: order.contactName,
          shippingStreet: order.shippingStreet,
          shippingHouseNumber: order.shippingHouseNumber,
          shippingPostalCode: order.shippingPostalCode,
          shippingCity: order.shippingCity,
          shippingCountry: order.shippingCountry,
          items: order.items.map((item) => ({
            productName: item.productName,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
          })),
        })
      )
    )
  );

  const merged = await PDFDocument.create();
  for (const pdfBase64 of pdfBase64ByOrder) {
    const source = await PDFDocument.load(Buffer.from(pdfBase64, "base64"));
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  const mergedBytes = await merged.save();

  return new NextResponse(Buffer.from(mergedBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pakbonnen-${fromRaw}-${toRaw}.pdf"`,
      "X-Pakbonnen-Included": String(orders.length),
    },
  });
}
