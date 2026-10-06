import { crc32, deflateRawSync } from "node:zlib";

// A small, dependency-free writer for .xlsx workbooks: one or more sheets with a bold,
// frozen header row, an autofilter, column widths, euro amounts as real numbers and an
// optional bold totals row with SUM formulas. Enough for financial exports.

export type XlsxColumnKind = "text" | "money" | "number" | "percent";
export type XlsxColumn = { header: string; kind?: XlsxColumnKind; width?: number };
export type XlsxCell = string | number | null;
export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
  /** Adds a bold "Totaal" row that sums the money columns. */
  totals?: boolean;
};

// Style ids in styles.xml (cellXfs order).
const STYLE = { text: 0, header: 1, money: 2, number: 3, percent: 4, totalLabel: 5, totalMoney: 6 } as const;

function escapeXml(value: string): string {
  return value
    // Characters XML 1.0 does not allow.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/gu, "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

/** Excel's sheet name rules: at most 31 characters, none of []:*?/\ and unique. */
export function safeSheetName(name: string, taken: Set<string>): string {
  const base = (name.replace(/[[\]:*?/\\]/gu, " ").trim() || "Blad").slice(0, 31);
  let candidate = base;
  for (let index = 2; taken.has(candidate.toLowerCase()); index += 1) candidate = `${base.slice(0, 28)} ${index}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

function columnLetter(index: number): string {
  let letters = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) letters = String.fromCharCode(65 + ((value - 1) % 26)) + letters;
  return letters;
}

function cellXml(reference: string, value: XlsxCell, style: number): string {
  if (value === null || value === "") return style ? `<c r="${reference}" s="${style}"/>` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function styleFor(kind: XlsxColumnKind | undefined): number {
  return kind === "money" ? STYLE.money : kind === "number" ? STYLE.number : kind === "percent" ? STYLE.percent : STYLE.text;
}

function sheetXml(sheet: XlsxSheet): string {
  const lastColumn = columnLetter(Math.max(0, sheet.columns.length - 1));
  const rows: string[] = [];
  rows.push(`<row r="1">${sheet.columns.map((column, index) => cellXml(`${columnLetter(index)}1`, column.header, STYLE.header)).join("")}</row>`);
  sheet.rows.forEach((row, rowIndex) => {
    const number = rowIndex + 2;
    rows.push(`<row r="${number}">${sheet.columns.map((column, index) => cellXml(`${columnLetter(index)}${number}`, row[index] ?? null, styleFor(column.kind))).join("")}</row>`);
  });
  if (sheet.totals) {
    const number = sheet.rows.length + 2;
    const cells = sheet.columns.map((column, index) => {
      const reference = `${columnLetter(index)}${number}`;
      if (index === 0) return cellXml(reference, "Totaal", STYLE.totalLabel);
      if (column.kind !== "money") return `<c r="${reference}" s="${STYLE.totalLabel}"/>`;
      const sum = Math.round(sheet.rows.reduce((total, row) => total + (typeof row[index] === "number" ? (row[index] as number) : 0), 0) * 100) / 100;
      const formula = sheet.rows.length ? `SUM(${columnLetter(index)}2:${columnLetter(index)}${number - 1})` : "0";
      return `<c r="${reference}" s="${STYLE.totalMoney}"><f>${formula}</f><v>${sum}</v></c>`;
    });
    rows.push(`<row r="${number}">${cells.join("")}</row>`);
  }
  const cols = sheet.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? Math.min(48, Math.max(10, column.header.length + 4))}" customWidth="1"/>`).join("");
  const dataEnd = sheet.rows.length + 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:${lastColumn}${dataEnd}"/></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;€&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="0.##&quot;%&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6E7A8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="medium"><color auto="1"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

type ZipEntry = { name: string; data: Buffer };

/** A plain zip archive (deflate), as the xlsx format requires. */
function zip(entries: ZipEntry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // 2026-01-01 00:00 in DOS date/time; a fixed stamp keeps output reproducible.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(dosTime, 12);
    record.writeUInt16LE(dosDate, 14);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(entry.data.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  if (!sheets.length) throw new Error("A workbook needs at least one sheet");
  const taken = new Set<string>();
  const named = sheets.map((sheet) => ({ ...sheet, name: safeSheetName(sheet.name, taken) }));
  const text = (value: string) => Buffer.from(value, "utf8");
  return zip([
    { name: "[Content_Types].xml", data: text(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${named.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { name: "_rels/.rels", data: text(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: text(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets><definedNames>${named.map((sheet, index) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${escapeXml(sheet.name).replace(/'/gu, "''")}'!$A$1:$${columnLetter(Math.max(0, sheet.columns.length - 1))}$${sheet.rows.length + 1}</definedName>`).join("")}</definedNames></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: text(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "xl/styles.xml", data: text(STYLES_XML) },
    ...named.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: text(sheetXml(sheet)) })),
  ]);
}
