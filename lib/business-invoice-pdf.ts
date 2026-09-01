import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { formatPrice } from "@/lib/format";

export type InvoiceLine = {
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPriceCents: number;
};

export type InvoicePdfInput = {
  invoiceNumber: string;
  createdAt: Date;
  companyName: string;
  contactName: string;
  email: string;
  kvkNumber: string | null;
  vatNumber: string | null;
  country: string;
  items: InvoiceLine[];
  subtotalCents: number;
  vatRatePercent: number;
  vatAmountCents: number;
  totalCents: number;
  /** e.g. the "BTW verlegd" explanation for a reverse-charge (BE) invoice. */
  vatNote: string | null;
};

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);
const ACCENT = rgb(0.62, 0.44, 0);

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export async function renderInvoicePdfBase64(input: InvoicePdfInput): Promise<string> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Factuur ${input.invoiceNumber}`);
  doc.setAuthor(LEGAL_IDENTITY.tradeName);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(LEGAL_IDENTITY.tradeName, { x: MARGIN, y, size: 20, font: bold, color: ACCENT });
  page.drawText("FACTUUR", { x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize("FACTUUR", 20), y, size: 20, font: bold, color: INK });
  y -= 20;
  page.drawText(LEGAL_IDENTITY.address, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
  y -= 12;
  page.drawText(`KVK ${LEGAL_IDENTITY.registrationNumber} · BTW ${LEGAL_IDENTITY.vatNumber}`, { x: MARGIN, y, size: 9, font: regular, color: MUTED });

  y -= 40;
  const columnGap = 260;
  const leftX = MARGIN;
  const rightX = MARGIN + columnGap;

  page.drawText("Factuurgegevens", { x: rightX, y, size: 10, font: bold, color: INK });
  page.drawText("Factuuraan", { x: leftX, y, size: 10, font: bold, color: INK });
  y -= 16;

  const details: [string, string][] = [
    ["Factuurnummer", input.invoiceNumber],
    ["Factuurdatum", formatDate(input.createdAt)],
    ["Valuta", "EUR"],
  ];
  let detailY = y;
  for (const [label, value] of details) {
    page.drawText(label, { x: rightX, y: detailY, size: 9, font: regular, color: MUTED });
    page.drawText(value, { x: rightX + 90, y: detailY, size: 9, font: regular, color: INK });
    detailY -= 14;
  }

  let recipientY = y;
  const recipientLines = [
    input.companyName,
    input.contactName,
    input.email,
    input.kvkNumber ? `KVK ${input.kvkNumber}` : null,
    input.vatNumber ? `BTW ${input.vatNumber}` : null,
    input.country === "BE" ? "België" : "Nederland",
  ].filter((line): line is string => Boolean(line));
  for (const line of recipientLines) {
    page.drawText(line, { x: leftX, y: recipientY, size: 9, font: regular, color: INK });
    recipientY -= 14;
  }

  y = Math.min(detailY, recipientY) - 24;

  // Line-items table
  const tableTop = y;
  const col = { name: leftX, qty: 330, price: 400, total: 480 };
  page.drawRectangle({ x: leftX, y: tableTop - 4, width: PAGE_WIDTH - MARGIN * 2, height: 20, color: rgb(0.96, 0.94, 0.89) });
  page.drawText("Omschrijving", { x: col.name + 4, y: tableTop, size: 9, font: bold, color: INK });
  page.drawText("Aantal", { x: col.qty, y: tableTop, size: 9, font: bold, color: INK });
  page.drawText("Prijs", { x: col.price, y: tableTop, size: 9, font: bold, color: INK });
  page.drawText("Totaal", { x: col.total, y: tableTop, size: 9, font: bold, color: INK });
  y = tableTop - 26;

  for (const item of input.items) {
    const label = item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName;
    drawWrappedText(page, label, leftX, y, col.qty - leftX - 8, 9, regular, INK);
    page.drawText(String(item.quantity), { x: col.qty, y, size: 9, font: regular, color: INK });
    page.drawText(formatPrice(item.unitPriceCents, "nl"), { x: col.price, y, size: 9, font: regular, color: INK });
    const lineTotal = formatPrice(item.unitPriceCents * item.quantity, "nl");
    page.drawText(lineTotal, { x: col.total, y, size: 9, font: regular, color: INK });
    y -= 18;
  }

  y -= 8;
  page.drawLine({ start: { x: leftX, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: MUTED });
  y -= 20;

  const totalsX = col.price;
  const drawTotal = (label: string, value: string, useBold = false) => {
    const font = useBold ? bold : regular;
    page.drawText(label, { x: totalsX, y, size: 10, font, color: INK });
    page.drawText(value, { x: col.total, y, size: 10, font, color: INK });
    y -= 16;
  };
  drawTotal("Subtotaal (excl. BTW)", formatPrice(input.subtotalCents, "nl"));
  drawTotal(`BTW (${input.vatRatePercent}%)`, formatPrice(input.vatAmountCents, "nl"));
  y -= 4;
  drawTotal("Totaal", formatPrice(input.totalCents, "nl"), true);

  if (input.vatNote) {
    y -= 20;
    drawWrappedText(page, input.vatNote, leftX, y, PAGE_WIDTH - MARGIN * 2, 9, regular, MUTED);
  }

  page.drawText(
    `${LEGAL_IDENTITY.tradeName} · ${LEGAL_IDENTITY.website} · ${LEGAL_IDENTITY.email}`,
    { x: leftX, y: MARGIN / 2, size: 8, font: regular, color: MUTED }
  );

  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      line = word;
      cursorY -= size + 3;
    } else {
      line = candidate;
    }
  }
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
}
