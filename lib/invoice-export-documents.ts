import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  privateOrderVat,
  type BusinessInvoiceRow,
  type ExportPeriod,
  type ExportType,
  type PrivateOrderRow,
} from "@/lib/invoice-export";
import { buildXlsx, type XlsxCell, type XlsxColumn, type XlsxSheet } from "@/lib/xlsx-writer";

// Excel and PDF versions of the invoices export. Amounts are euros (not cents) in the
// workbook so spreadsheet sums work; every table ends with a totals line. With all
// categories, Excel gets one tab per category plus an overview.

const TIME_ZONE = "Europe/Amsterdam";

function date(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(value) : "";
}

function euros(cents: number): number {
  return Math.round(cents) / 100;
}

export type ExportTable = { name: string; columns: XlsxColumn[]; rows: XlsxCell[][] };

function businessTable(business: BusinessInvoiceRow[]): ExportTable {
  return {
    name: "Zakelijk",
    columns: [
      { header: "Factuurnummer", width: 18 }, { header: "Land", width: 7 }, { header: "Klantnummer", width: 14 }, { header: "Bedrijf", width: 32 },
      { header: "Factuurdatum", width: 13 }, { header: "Subtotaal excl. BTW", kind: "money", width: 18 }, { header: "BTW-percentage", kind: "percent", width: 14 },
      { header: "BTW-bedrag", kind: "money", width: 14 }, { header: "Totaal incl. BTW", kind: "money", width: 17 }, { header: "BTW-regeling", width: 14 },
      { header: "Peppol-status", width: 14 },
    ],
    rows: business.map((invoice) => [
      invoice.invoiceNumber, invoice.country, invoice.customerNumber ?? "", invoice.companyName, date(invoice.createdAt),
      euros(invoice.subtotalCents), invoice.vatRatePercent, euros(invoice.vatAmountCents), euros(invoice.totalCents),
      invoice.vatRegime === "REVERSE_CHARGE" ? "BTW verlegd" : "Standaard", invoice.peppolStatus,
    ]),
  };
}

function privateTable(orders: PrivateOrderRow[]): ExportTable {
  return {
    name: "Particulier",
    columns: [
      { header: "Bestelnummer", width: 16 }, { header: "Land", width: 7 }, { header: "Klant", width: 26 }, { header: "E-mail", width: 30 },
      { header: "Besteldatum", width: 12 }, { header: "Betaaldatum", width: 12 }, { header: "Status", width: 11 }, { header: "Korting", kind: "money", width: 11 },
      { header: "Verzendkosten", kind: "money", width: 14 }, { header: "Subtotaal excl. BTW", kind: "money", width: 18 }, { header: "BTW-percentage", kind: "percent", width: 14 },
      { header: "BTW-bedrag", kind: "money", width: 13 }, { header: "Totaal incl. BTW", kind: "money", width: 16 }, { header: "Terugbetaald", kind: "money", width: 13 },
      { header: "Netto incl. BTW", kind: "money", width: 15 },
    ],
    rows: orders.map((order) => {
      const vat = privateOrderVat(order.country, order.totalCents);
      return [
        order.orderNumber, order.country, order.contactName, order.contactEmail, date(order.createdAt), date(order.paidAt),
        order.status === "FULFILLED" ? "Verzonden" : "Betaald", euros(order.discountCents), euros(order.shippingCents),
        euros(vat.subtotalCents), vat.ratePercent, euros(vat.vatCents), euros(vat.totalCents), euros(order.refundedCents),
        euros(order.totalCents - order.refundedCents),
      ];
    }),
  };
}

function overviewTable(business: BusinessInvoiceRow[], orders: PrivateOrderRow[]): ExportTable {
  const rows = [
    ...business.map((invoice) => ({ at: invoice.createdAt, cells: ["Zakelijk", invoice.invoiceNumber, invoice.country, invoice.companyName, date(invoice.createdAt), euros(invoice.subtotalCents), invoice.vatRatePercent, euros(invoice.vatAmountCents), euros(invoice.totalCents), 0] as XlsxCell[] })),
    ...orders.map((order) => {
      const vat = privateOrderVat(order.country, order.totalCents);
      return { at: order.createdAt, cells: ["Particulier", order.orderNumber, order.country, order.contactName, date(order.createdAt), euros(vat.subtotalCents), vat.ratePercent, euros(vat.vatCents), euros(vat.totalCents), euros(order.refundedCents)] as XlsxCell[] };
    }),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());
  return {
    name: "Overzicht",
    columns: [
      { header: "Type", width: 12 }, { header: "Nummer", width: 18 }, { header: "Land", width: 7 }, { header: "Klant", width: 30 }, { header: "Datum", width: 12 },
      { header: "Subtotaal excl. BTW", kind: "money", width: 18 }, { header: "BTW-percentage", kind: "percent", width: 14 }, { header: "BTW-bedrag", kind: "money", width: 13 },
      { header: "Totaal incl. BTW", kind: "money", width: 16 }, { header: "Terugbetaald", kind: "money", width: 13 },
    ],
    rows: rows.map((row) => row.cells),
  };
}

/** The tables of an export: one per category, plus an overview when both are included. */
export function invoiceExportTables(type: ExportType, business: BusinessInvoiceRow[], orders: PrivateOrderRow[]): ExportTable[] {
  if (type === "zakelijk") return [businessTable(business)];
  if (type === "particulier") return [privateTable(orders)];
  return [overviewTable(business, orders), businessTable(business), privateTable(orders)];
}

export function moneyTotals(table: ExportTable): Array<number | null> {
  return table.columns.map((column, index) => column.kind === "money"
    ? Math.round(table.rows.reduce((sum, row) => sum + (typeof row[index] === "number" ? (row[index] as number) : 0), 0) * 100) / 100
    : null);
}

export function buildInvoiceXlsx(tables: ExportTable[]): Buffer {
  return buildXlsx(tables.map((table): XlsxSheet => ({ ...table, totals: true })));
}

// ---------- PDF ----------

const PAGE = { width: 841.89, height: 595.28, margin: 36 }; // A4 landscape
const euroFormat = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

/** Compact column sets for paper: the most important fields of each table. */
const PDF_COLUMNS: Record<string, string[]> = {
  Zakelijk: ["Factuurnummer", "Land", "Bedrijf", "Factuurdatum", "Subtotaal excl. BTW", "BTW-percentage", "BTW-bedrag", "Totaal incl. BTW", "BTW-regeling"],
  Particulier: ["Bestelnummer", "Land", "Klant", "Besteldatum", "Status", "Subtotaal excl. BTW", "BTW-bedrag", "Totaal incl. BTW", "Terugbetaald", "Netto incl. BTW"],
  Overzicht: ["Type", "Nummer", "Land", "Klant", "Datum", "Subtotaal excl. BTW", "BTW-bedrag", "Totaal incl. BTW", "Terugbetaald"],
};

/** Standard PDF fonts only cover Windows-1252; replace anything else instead of failing. */
function printable(font: PDFFont, value: string): string {
  return [...value].map((character) => {
    try {
      font.encodeText(character);
      return character;
    } catch {
      return "?";
    }
  }).join("");
}

function fit(font: PDFFont, value: string, size: number, width: number): string {
  let text = printable(font, value);
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > width) text = text.slice(0, -1);
  return `${text}…`;
}

function cellText(value: XlsxCell, kind: XlsxColumn["kind"]): string {
  if (value === null || value === "") return "";
  if (typeof value === "number") return kind === "money" ? euroFormat.format(value) : kind === "percent" ? `${value}%` : String(value);
  return value;
}

export async function buildInvoicePdf(
  tables: ExportTable[],
  meta: { title: string; scope: string; generatedAt: Date },
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title);
  pdf.setCreator("De Notenman admin");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = 8;
  const rowHeight = 14;
  const pages: PDFPage[] = [];
  const contentWidth = PAGE.width - PAGE.margin * 2;

  for (const table of tables) {
    const wanted = PDF_COLUMNS[table.name] ?? table.columns.map((column) => column.header);
    const indexes = wanted.map((header) => table.columns.findIndex((column) => column.header === header)).filter((index) => index >= 0);
    const columns = indexes.map((index) => table.columns[index]);
    const weights = columns.map((column) => column.width ?? 12);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (weight / totalWeight) * contentWidth);
    const totals = moneyTotals(table);

    let page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    let y = PAGE.height - PAGE.margin;
    const drawHeader = () => {
      page.drawText(printable(bold, `${meta.title} · ${table.name}`), { x: PAGE.margin, y: y - 12, size: 13, font: bold });
      page.drawText(printable(regular, meta.scope), { x: PAGE.margin, y: y - 26, size: 9, font: regular, color: rgb(0.35, 0.35, 0.35) });
      y -= 44;
      page.drawRectangle({ x: PAGE.margin, y: y - 4, width: contentWidth, height: rowHeight, color: rgb(0.965, 0.906, 0.659) });
      let x = PAGE.margin;
      columns.forEach((column, position) => {
        const label = fit(bold, column.header, size, widths[position] - 4);
        const right = column.kind === "money" || column.kind === "percent";
        page.drawText(label, { x: right ? x + widths[position] - 2 - bold.widthOfTextAtSize(label, size) : x + 2, y, size, font: bold });
        x += widths[position];
      });
      y -= rowHeight;
    };
    drawHeader();

    const drawRow = (cells: XlsxCell[], font: PDFFont) => {
      let x = PAGE.margin;
      columns.forEach((column, position) => {
        const text = fit(font, cellText(cells[position] ?? null, column.kind), size, widths[position] - 4);
        const right = column.kind === "money" || column.kind === "percent";
        page.drawText(text, { x: right ? x + widths[position] - 2 - font.widthOfTextAtSize(text, size) : x + 2, y, size, font });
        x += widths[position];
      });
      y -= rowHeight;
    };

    for (const row of table.rows) {
      if (y < PAGE.margin + rowHeight * 3) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        pages.push(page);
        y = PAGE.height - PAGE.margin;
        drawHeader();
      }
      drawRow(indexes.map((index) => row[index] ?? null), regular);
    }
    if (!table.rows.length) {
      page.drawText("Geen regels in deze periode.", { x: PAGE.margin + 2, y, size, font: regular, color: rgb(0.4, 0.4, 0.4) });
      y -= rowHeight;
    }
    // The line and the totals.
    page.drawLine({ start: { x: PAGE.margin, y: y + rowHeight - 3 }, end: { x: PAGE.margin + contentWidth, y: y + rowHeight - 3 }, thickness: 1.2 });
    drawRow(indexes.map((index, position) => (position === 0 ? `Totaal (${table.rows.length})` : totals[index])), bold);
  }

  pages.forEach((page, index) => {
    const footer = `Gegenereerd ${new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(meta.generatedAt)} · pagina ${index + 1} van ${pages.length}`;
    page.drawText(footer, { x: PAGE.margin, y: PAGE.margin / 2, size: 7, font: regular, color: rgb(0.45, 0.45, 0.45) });
  });
  return Buffer.from(await pdf.save());
}

export function exportScopeLabel(type: ExportType, country: "NL" | "BE" | null, period: ExportPeriod | null): string {
  const types = { alle: "Zakelijk en particulier", zakelijk: "Zakelijk", particulier: "Particulier" } as const;
  return [types[type], country ?? "NL en BE", period?.label ?? "alle periodes"].join(" · ");
}
