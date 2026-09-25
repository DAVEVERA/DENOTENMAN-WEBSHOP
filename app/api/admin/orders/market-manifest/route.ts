import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { parseAmsterdamCalendarDay } from "@/lib/amsterdam-calendar";
import { groupOrdersForMarketManifest } from "@/lib/market-manifest";
import { renderMarketManifestPdfBase64 } from "@/lib/market-manifest-pdf";

export const runtime = "nodejs";

// Only PAID pickup orders are still waiting to be handed out at the stall —
// once handed over an admin marks the order FULFILLED, at which point it
// drops off the manifest.
const AWAITING_PICKUP_STATUSES = ["PAID"] as const;

export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) {
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
      deliveryMethod: "PICKUP",
      createdAt: { gte: from, lte: to },
      status: { in: [...AWAITING_PICKUP_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "NO_ORDERS" }, { status: 404 });
  }

  const groups = groupOrdersForMarketManifest(
    orders.map((order) => ({
      id: order.id,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      pickupLocationId: order.pickupLocationId,
      items: order.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
      })),
    }))
  );

  const pdfBase64 = await renderMarketManifestPdfBase64({ generatedAt: new Date(), groups });

  return new NextResponse(Buffer.from(pdfBase64, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="afhaalmanifest-${fromRaw}-${toRaw}.pdf"`,
      "X-Manifest-Orders": String(orders.length),
      "X-Manifest-Groups": String(groups.length),
    },
  });
}
