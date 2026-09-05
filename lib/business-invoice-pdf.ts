import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { formatPrice } from "@/lib/format";

const LOGO_SIZE = 28;
const CUSTOMER_LOGO_MAX_WIDTH = 112;
const CUSTOMER_LOGO_MAX_HEIGHT = 34;

async function loadLogoPng(): Promise<Buffer> {
  const svgPath = path.join(process.cwd(), "public", "brand", "logo-mark.svg");
  const svg = await readFile(svgPath);
  return sharp(svg).resize(LOGO_SIZE * 4, LOGO_SIZE * 4).png().toBuffer();
}

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
  /** Immutable bytes read at invoice creation time; never a live URL. */
  customerLogoBytes?: Uint8Array | null;
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

  let brandTextX = MARGIN;
  try {
    const logoPng = await loadLogoPng();
    const logoImage = await doc.embedPng(logoPng);
    page.drawImage(logoImage, { x: MARGIN, y: y - LOGO_SIZE + 4, width: LOGO_SIZE, height: LOGO_SIZE });
    brandTextX = MARGIN + LOGO_SIZE + 10;
  } catch (error) {
    // A missing/unreadable logo asset must never block invoice generation —
    // fall back to the text-only header used before the logo existed.
    console.error("Could not embed invoice logo, falling back to text-only header", error);
  }

  page.drawText(LEGAL_IDENTITY.tradeName, { x: brandTextX, y, size: 20, font: bold, color: ACCENT });
  page.drawText("FACTUUR", { x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize("FACTUUR", 20), y, size: 20, font: bold, color: INK });
  y -= 20;
  // Indented to brandTextX (not MARGIN) so these lines never sit under the
  // logo mark, regardless of its exact height.
  page.drawText(LEGAL_IDENTITY.address, { x: brandTextX, y, size: 9, font: regular, color: MUTED });
  y -= 12;
  page.drawText(`KVK ${LEGAL_IDENTITY.registrationNumber} · BTW ${LEGAL_IDENTITY.vatNumber}`, { x: brandTextX, y, size: 9, font: regular, color: MUTED });

  if (input.customerLogoBytes?.byteLength) {
    try {
      const normalized = await sharp(Buffer.from(input.customerLogoBytes), {
        failOn: "error",
        limitInputPixels: 16_000_000,
      })
        .rotate()
        .resize({
          width: CUSTOMER_LOGO_MAX_WIDTH * 4,
          height: CUSTOMER_LOGO_MAX_HEIGHT * 4,
          fit: "inside",
          withoutEnlargement: false,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      const image = await doc.embedPng(normalized.data);
      const scale = Math.min(
        CUSTOMER_LOGO_MAX_WIDTH / normalized.info.width,
        CUSTOMER_LOGO_MAX_HEIGHT / normalized.info.height,
      );
      const width = normalized.info.width * scale;
      const height = normalized.info.height * scale;
      page.drawImage(image, {
        x: PAGE_WIDTH - MARGIN - width,
        y: y - height + 6,
        width,
        height,
      });
    } catch (error) {
      // The invoice is the source of truth. A missing/corrupt optional logo
      // must never prevent that invoice from being issued.
      console.error("Could not embed customer logo in invoice", error);
    }
  }

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

  // Line-items table. Money columns are right-aligned against a fixed edge
  // so amounts of any width (four digits, cents, a wide "Totaal" label)
  // never collide with a neighboring column.
  const rightEdge = PAGE_WIDTH - MARGIN;
  const tableTop = y;
  const col = { name: leftX, qty: 320, priceRight: 460, totalRight: rightEdge };
  page.drawRectangle({ x: leftX, y: tableTop - 4, width: PAGE_WIDTH - MARGIN * 2, height: 20, color: rgb(0.96, 0.94, 0.89) });
  page.drawText("Omschrijving", { x: col.name + 4, y: tableTop, size: 9, font: bold, color: INK });
  page.drawText("Aantal", { x: col.qty, y: tableTop, size: 9, font: bold, color: INK });
  drawTextRight(page, "Prijs", col.priceRight, tableTop, 9, bold, INK);
  drawTextRight(page, "Totaal", col.totalRight, tableTop, 9, bold, INK);
  y = tableTop - 26;

  for (const item of input.items) {
    const label = item.variantLabel ? `${item.productName} (${item.variantLabel})` : item.productName;
    drawWrappedText(page, label, leftX, y, col.qty - leftX - 8, 9, regular, INK);
    page.drawText(String(item.quantity), { x: col.qty, y, size: 9, font: regular, color: INK });
    drawTextRight(page, formatPrice(item.unitPriceCents, "nl"), col.priceRight, y, 9, regular, INK);
    const lineTotal = formatPrice(item.unitPriceCents * item.quantity, "nl");
    drawTextRight(page, lineTotal, col.totalRight, y, 9, regular, INK);
    y -= 18;
  }

  y -= 8;
  page.drawLine({ start: { x: leftX, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: MUTED });
  y -= 20;

  const totalsLabelX = 300;
  const drawTotal = (label: string, value: string, useBold = false) => {
    const font = useBold ? bold : regular;
    page.drawText(label, { x: totalsLabelX, y, size: 10, font, color: INK });
    drawTextRight(page, value, col.totalRight, y, 10, font, INK);
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

function drawTextRight(
  page: PDFPage,
  text: string,
  rightEdge: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightEdge - width, y, size, font, color });
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
