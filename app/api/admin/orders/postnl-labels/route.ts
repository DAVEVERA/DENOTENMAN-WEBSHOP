import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { PostnlError } from "@/lib/postnl";
import { ensurePostnlLabel, PostnlLabelGuardError } from "@/lib/postnl-labels";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import pLimit from "p-limit";
import { parseAmsterdamCalendarDay } from "@/lib/amsterdam-calendar";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return (await verifyAdminSessionToken(token)) !== null;
}

// Only these statuses represent something actually worth shipping.
const SHIPPABLE_STATUSES = ["PAID", "FULFILLED"] as const;
const MAX_LABELS_PER_BATCH = 20;
const LABEL_CONCURRENCY = 4;

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
    select: { id: true },
    take: MAX_LABELS_PER_BATCH + 1,
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "NO_ORDERS" }, { status: 404 });
  }
  if (orders.length > MAX_LABELS_PER_BATCH) {
    return NextResponse.json(
      { error: "BATCH_TOO_LARGE", maxLabels: MAX_LABELS_PER_BATCH, message: "Kies een kleiner datumbereik en maak maximaal 20 labels per batch." },
      { status: 413 }
    );
  }

  const failed: { orderId: string; message: string }[] = [];
  const labelBase64ByOrder: { orderId: string; labelBase64: string }[] = [];

  const limit = pLimit(LABEL_CONCURRENCY);
  const results = await Promise.all(orders.map((order) => limit(async () => {
    try {
      const label = await ensurePostnlLabel(order.id);
      return { orderId: order.id, labelBase64: label.labelBase64, message: null };
    } catch (error) {
      return {
        orderId: order.id,
        labelBase64: null,
        message: error instanceof PostnlError || error instanceof PostnlLabelGuardError ? error.message : "Onbekende fout",
      };
    }
  })));
  for (const result of results) {
    if (result.labelBase64) labelBase64ByOrder.push({ orderId: result.orderId, labelBase64: result.labelBase64 });
    else failed.push({ orderId: result.orderId, message: result.message ?? "Onbekende fout" });
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
