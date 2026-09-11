import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { InvoiceDocument } from "@/components/invoice-pdf/InvoiceDocument";
import { getPublishedInvoiceTemplateBlocks } from "@/lib/invoice-template";
import { renderHtmlToPdfBase64 } from "@/lib/invoice-pdf-renderer";

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

async function loadLogoDataUri(): Promise<string | null> {
  try {
    const svgPath = path.join(process.cwd(), "public", "brand", "logo-wordmark.svg");
    const svg = await readFile(svgPath);
    const png = await sharp(svg).resize({ width: 1200 }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (error) {
    // Invoice generation must continue if the local brand asset is unavailable.
    console.error("Could not embed De Notenman invoice logo", error);
    return null;
  }
}

export async function renderInvoicePdfBase64(input: InvoicePdfInput): Promise<string> {
  // Dynamically imported (not a static top-level import) so this file's
  // react-dom/server usage stays out of the RSC module graph that reaches
  // it through lib/orders.ts -> app/admin/(dashboard)/bestellingen/[id]/page.tsx.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const [blocks, logoDataUri] = await Promise.all([
    getPublishedInvoiceTemplateBlocks(),
    loadLogoDataUri(),
  ]);
  const html =
    "<!DOCTYPE html>" +
    renderToStaticMarkup(<InvoiceDocument input={input} blocks={blocks} logoDataUri={logoDataUri} />);
  return renderHtmlToPdfBase64(html);
}
