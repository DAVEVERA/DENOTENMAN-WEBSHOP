import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { formatPrice } from "@/lib/format";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 34;
const ROW_HEIGHT = 30;

const INK = rgb(0.2, 0.2, 0.2);
const MUTED = rgb(0.43, 0.42, 0.38);
const GOLD = rgb(0.88, 0.7, 0);
const GOLD_PALE = rgb(1, 0.98, 0.85);
const SOFT = rgb(0.96, 0.95, 0.93);
const ROW_FILL = rgb(0.985, 0.98, 0.965);
const LINE = rgb(0.86, 0.84, 0.8);
const WHITE = rgb(1, 1, 1);
const SUCCESS = rgb(0.2, 0.48, 0.23);

async function loadLogoPng(): Promise<Buffer> {
  const svgPath = path.join(process.cwd(), "public", "brand", "logo-wordmark.svg");
  const svg = await readFile(svgPath);
  return sharp(svg).resize({ width: 1200 }).png().toBuffer();
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
  contactName: string | null;
  email: string;
  kvkNumber: string | null;
  vatNumber: string | null;
  country: string;
  billingStreet: string | null;
  billingHouseNumber: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  billingCountry: string | null;
  items: InvoiceLine[];
  subtotalCents: number;
  vatRatePercent: number;
  vatAmountCents: number;
  totalCents: number;
  paidCents: number;
  /** e.g. the "BTW verlegd" explanation for a reverse-charge (BE) invoice. */
  vatNote: string | null;
};

type InvoiceFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function countryName(country: string | null): string {
  const normalized = country?.trim().toUpperCase();
  if (normalized === "BE") return "België";
  if (normalized === "NL") return "Nederland";
  return country?.trim() || "";
}

function valueLine(label: string, value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? `${label} ${normalized}` : null;
}

export function invoiceRecipientLines(input: InvoicePdfInput): string[] {
  const street = [input.billingStreet?.trim(), input.billingHouseNumber?.trim()]
    .filter(Boolean)
    .join(" ");
  const city = [input.billingPostalCode?.trim(), input.billingCity?.trim()]
    .filter(Boolean)
    .join(" ");
  const billingCountry = countryName(input.billingCountry || input.country);

  return [
    input.companyName.trim(),
    input.contactName?.trim() ? `t.a.v. ${input.contactName.trim()}` : null,
    street || null,
    city || null,
    billingCountry || null,
    input.email.trim(),
    valueLine("KVK", input.kvkNumber),
    valueLine("BTW", input.vatNumber),
  ].filter((line): line is string => Boolean(line));
}

export async function renderInvoicePdfBase64(input: InvoicePdfInput): Promise<string> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Factuur ${input.invoiceNumber}`);
  doc.setAuthor(LEGAL_IDENTITY.tradeName);
  doc.setSubject("Betaalde zakelijke bestelling");

  const fonts: InvoiceFonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(await loadLogoPng());
  } catch (error) {
    // Invoice generation must continue if the local brand asset is unavailable.
    console.error("Could not embed De Notenman invoice logo", error);
  }

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawFirstPageHeader(page, input, fonts, logo);
  y = drawItemsTableHeader(page, y, fonts);

  for (let index = 0; index < input.items.length; index += 1) {
    if (y - ROW_HEIGHT < 96) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawContinuationHeader(page, input, fonts, logo);
      y = drawItemsTableHeader(page, y, fonts);
    }
    y = drawItemRow(page, input.items[index], index, y, fonts);
  }

  const totalsMinimumY = input.vatNote ? 220 : 190;
  if (y < totalsMinimumY) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = drawContinuationHeader(page, input, fonts, logo);
  }
  drawTotalsAndPayment(page, input, y - 18, fonts);

  const pages = doc.getPages();
  pages.forEach((currentPage, index) => {
    drawFooter(currentPage, fonts, index + 1, pages.length);
  });

  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

function drawFirstPageHeader(
  page: PDFPage,
  input: InvoicePdfInput,
  fonts: InvoiceFonts,
  logo: PDFImage | null
): number {
  const logoBottom = drawCenteredLogo(page, logo, fonts, 744, 166);

  page.drawLine({
    start: { x: MARGIN, y: logoBottom - 16 },
    end: { x: PAGE_WIDTH - MARGIN, y: logoBottom - 16 },
    thickness: 1.8,
    color: GOLD,
  });

  const titleY = logoBottom - 56;
  page.drawText("Factuur", { x: MARGIN, y: titleY, size: 24, font: fonts.bold, color: INK });
  drawTextRight(
    page,
    `Zakelijke bestelling | ${countryName(input.country)}`,
    PAGE_WIDTH - MARGIN,
    titleY + 4,
    8.5,
    fonts.regular,
    MUTED
  );

  const merchantLines = merchantAddressLines();
  const recipientLines = invoiceRecipientLines(input);
  const blockY = titleY - 48;
  const merchantRows = drawAddressBlock(page, "Van", merchantLines, MARGIN, blockY, fonts);
  const recipientRows = drawAddressBlock(page, "Factuuradres", recipientLines, 317, blockY, fonts);

  const addressRows = Math.max(merchantRows, recipientRows);
  const metadataTop = blockY - 31 - addressRows * 13;
  return drawMetadata(page, input, metadataTop, fonts) - 42;
}

function drawCenteredLogo(
  page: PDFPage,
  logo: PDFImage | null,
  fonts: InvoiceFonts,
  topY: number,
  width: number
): number {
  if (!logo) {
    const text = LEGAL_IDENTITY.tradeName;
    const size = 20;
    const textWidth = fonts.bold.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (PAGE_WIDTH - textWidth) / 2,
      y: topY - size,
      size,
      font: fonts.bold,
      color: INK,
    });
    return topY - size;
  }

  const scaled = logo.scale(width / logo.width);
  const x = (PAGE_WIDTH - scaled.width) / 2;
  const y = topY - scaled.height;
  page.drawImage(logo, { x, y, width: scaled.width, height: scaled.height });
  return y;
}

function merchantAddressLines(): string[] {
  const [street = LEGAL_IDENTITY.address, locality = ""] = LEGAL_IDENTITY.address
    .split(",")
    .map((part) => part.trim());
  return [LEGAL_IDENTITY.tradeName, street, locality, "Nederland", LEGAL_IDENTITY.email].filter(Boolean);
}

function drawAddressBlock(
  page: PDFPage,
  title: string,
  lines: string[],
  x: number,
  y: number,
  fonts: InvoiceFonts
): number {
  page.drawText(title, { x, y, size: 9.5, font: fonts.bold, color: INK });
  page.drawLine({
    start: { x, y: y - 7 },
    end: { x: x + 70, y: y - 7 },
    thickness: 1.5,
    color: GOLD,
  });

  let renderedRows = 0;
  lines.forEach((line, index) => {
    const font = index === 0 ? fonts.bold : fonts.regular;
    wrapText(line, 210, font, 8.5).forEach((wrappedLine) => {
      page.drawText(wrappedLine, {
        x,
        y: y - 28 - renderedRows * 13,
        size: 8.5,
        font,
        color: INK,
      });
      renderedRows += 1;
    });
  });
  return renderedRows;
}

function drawMetadata(page: PDFPage, input: InvoicePdfInput, topY: number, fonts: InvoiceFonts): number {
  const height = 50;
  page.drawRectangle({ x: MARGIN, y: topY - height, width: CONTENT_WIDTH, height, color: SOFT });

  const columnWidth = CONTENT_WIDTH / 3;
  const entries = [
    ["Factuurnummer", input.invoiceNumber, INK],
    ["Factuurdatum", formatDate(input.createdAt), INK],
    ["Status", "BETAALD", SUCCESS],
  ] as const;

  entries.forEach(([label, value, color], index) => {
    const x = MARGIN + index * columnWidth + 16;
    page.drawText(label, { x, y: topY - 18, size: 7.5, font: fonts.regular, color: MUTED });
    page.drawText(value, { x, y: topY - 36, size: 10.5, font: fonts.bold, color });
    if (index < entries.length - 1) {
      const dividerX = MARGIN + (index + 1) * columnWidth;
      page.drawLine({
        start: { x: dividerX, y: topY - height + 9 },
        end: { x: dividerX, y: topY - 9 },
        thickness: 0.5,
        color: LINE,
      });
    }
  });

  return topY - height;
}

function drawContinuationHeader(
  page: PDFPage,
  input: InvoicePdfInput,
  fonts: InvoiceFonts,
  logo: PDFImage | null
): number {
  const logoBottom = drawCenteredLogo(page, logo, fonts, 790, 112);
  page.drawLine({
    start: { x: MARGIN, y: logoBottom - 12 },
    end: { x: PAGE_WIDTH - MARGIN, y: logoBottom - 12 },
    thickness: 1.3,
    color: GOLD,
  });
  page.drawText(`Factuur ${input.invoiceNumber}`, {
    x: MARGIN,
    y: logoBottom - 38,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  drawTextRight(page, input.companyName, PAGE_WIDTH - MARGIN, logoBottom - 38, 8.5, fonts.regular, MUTED);
  return logoBottom - 66;
}

function drawItemsTableHeader(page: PDFPage, y: number, fonts: InvoiceFonts): number {
  page.drawText("Bestelling", { x: MARGIN, y, size: 13.5, font: fonts.bold, color: INK });
  const top = y - 28;
  page.drawRectangle({ x: MARGIN, y: top - 25, width: CONTENT_WIDTH, height: 25, color: INK });
  page.drawText("Omschrijving", { x: MARGIN + 12, y: top - 16, size: 8.5, font: fonts.bold, color: WHITE });
  page.drawText("Aantal", { x: 348, y: top - 16, size: 8.5, font: fonts.bold, color: WHITE });
  drawTextRight(page, "Prijs per stuk", 475, top - 16, 8.5, fonts.bold, WHITE);
  drawTextRight(page, "Bedrag", PAGE_WIDTH - MARGIN - 10, top - 16, 8.5, fonts.bold, WHITE);
  return top - 25;
}

function drawItemRow(
  page: PDFPage,
  item: InvoiceLine,
  index: number,
  y: number,
  fonts: InvoiceFonts
): number {
  const bottom = y - ROW_HEIGHT;
  if (index % 2 === 0) {
    page.drawRectangle({ x: MARGIN, y: bottom, width: CONTENT_WIDTH, height: ROW_HEIGHT, color: ROW_FILL });
  }

  page.drawText(truncateText(item.productName, 245, fonts.bold, 8.7), {
    x: MARGIN + 12,
    y: y - 14,
    size: 8.7,
    font: fonts.bold,
    color: INK,
    });
  if (item.variantLabel) {
    page.drawText(truncateText(item.variantLabel, 245, fonts.regular, 7.2), {
      x: MARGIN + 12,
      y: y - 25,
      size: 7.2,
      font: fonts.regular,
      color: MUTED,
    });
  }
  page.drawText(String(item.quantity), { x: 356, y: y - 19, size: 8.5, font: fonts.regular, color: INK });
  drawTextRight(page, formatPrice(item.unitPriceCents, "nl"), 475, y - 19, 8.5, fonts.regular, INK);
  drawTextRight(
    page,
    formatPrice(item.unitPriceCents * item.quantity, "nl"),
    PAGE_WIDTH - MARGIN - 10,
    y - 19,
    8.5,
    fonts.bold,
    INK
  );
  return bottom;
}

function drawTotalsAndPayment(
  page: PDFPage,
  input: InvoicePdfInput,
  startY: number,
  fonts: InvoiceFonts
): void {
  page.drawLine({
    start: { x: MARGIN, y: startY },
    end: { x: PAGE_WIDTH - MARGIN, y: startY },
    thickness: 0.6,
    color: LINE,
  });

  let y = startY - 26;
  const labelX = 355;
  const valueRight = PAGE_WIDTH - MARGIN;
  const vatLabel = input.vatRatePercent === 0 ? "BTW verlegd (0%)" : `BTW (${input.vatRatePercent}%)`;
  const rows: Array<[string, string, boolean]> = [
    ["Subtotaal excl. BTW", formatPrice(input.subtotalCents, "nl"), false],
    [vatLabel, formatPrice(input.vatAmountCents, "nl"), false],
    ["Totaal", formatPrice(input.totalCents, "nl"), true],
  ];

  rows.forEach(([label, value, bold], index) => {
    if (index === rows.length - 1) {
      page.drawLine({
        start: { x: labelX, y: y + 12 },
        end: { x: valueRight, y: y + 12 },
        thickness: 1.5,
        color: GOLD,
      });
    }
    const font = bold ? fonts.bold : fonts.regular;
    const size = bold ? 10.5 : 9;
    page.drawText(label, { x: labelX, y, size, font, color: bold ? INK : MUTED });
    drawTextRight(page, value, valueRight, y, size, font, INK);
    y -= 22;
  });

  if (input.vatNote) {
    y -= 5;
    y = drawWrappedText(page, input.vatNote, MARGIN, y, 300, 7.5, fonts.regular, MUTED, 10) - 7;
  }

  const paymentY = Math.max(y - 55, FOOTER_Y + 48);
  page.drawRectangle({ x: MARGIN, y: paymentY, width: CONTENT_WIDTH, height: 48, color: GOLD_PALE });
  page.drawText(`Betaald bedrag: ${formatPrice(input.paidCents, "nl")}`, {
    x: MARGIN + 16,
    y: paymentY + 29,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawText("Nog te voldoen", {
    x: MARGIN + 16,
    y: paymentY + 12,
    size: 10.5,
    font: fonts.bold,
    color: INK,
  });
  drawTextRight(
    page,
    formatPrice(Math.max(0, input.totalCents - input.paidCents), "nl"),
    PAGE_WIDTH - MARGIN - 16,
    paymentY + 11,
    15,
    fonts.bold,
    SUCCESS
  );
}

function drawFooter(page: PDFPage, fonts: InvoiceFonts, pageNumber: number, pageCount: number): void {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_Y + 17 },
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_Y + 17 },
    thickness: 0.6,
    color: LINE,
  });
  page.drawText("Bedankt voor uw bestelling bij De Notenman.", {
    x: MARGIN,
    y: FOOTER_Y,
    size: 7.8,
    font: fonts.bold,
    color: INK,
  });
  drawTextRight(
    page,
    `KVK ${LEGAL_IDENTITY.registrationNumber} | BTW ${LEGAL_IDENTITY.vatNumber} | ${pageNumber}/${pageCount}`,
    PAGE_WIDTH - MARGIN,
    FOOTER_Y,
    7.2,
    fonts.regular,
    MUTED
  );
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
  color: ReturnType<typeof rgb>,
  lineHeight = size + 3
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      line = word;
      cursorY -= lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }
  return cursorY;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function truncateText(text: string, maxWidth: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const suffix = "...";
  let truncated = text;
  while (truncated && font.widthOfTextAtSize(`${truncated}${suffix}`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated.trimEnd()}${suffix}`;
}
