import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { getOrCreateDraftInvoiceTemplate } from "@/lib/invoice-template";
import { InvoiceDocument } from "@/components/invoice-pdf/InvoiceDocument";
import { renderHtmlToPdfBase64 } from "@/lib/invoice-pdf-renderer";
import type { InvoicePdfInput } from "@/lib/business-invoice-pdf";

// Fixed sample data for the template preview. This must never be replaced
// with a real order/customer lookup — the preview route is not allowed to
// touch real customer data.
const SAMPLE_INPUT: InvoicePdfInput = {
  invoiceNumber: "NL0000",
  createdAt: new Date(),
  companyName: "Voorbeeld BV",
  contactName: "Voorbeeld Klant",
  email: "voorbeeld@denotenman.com",
  kvkNumber: "00000000",
  vatNumber: "NL000000000B00",
  country: "NL",
  billingStreet: "Voorbeeldstraat",
  billingHouseNumber: "1",
  billingPostalCode: "1234AB",
  billingCity: "Voorbeeldstad",
  billingCountry: "NL",
  items: [
    { productName: "Amandelen naturel", variantLabel: "500 gram", quantity: 3, unitPriceCents: 495 },
    { productName: "Cashewnoten geroosterd", variantLabel: "1000 gram", quantity: 1, unitPriceCents: 1295 },
  ],
  subtotalCents: 2780,
  vatRatePercent: 9,
  vatAmountCents: 250,
  totalCents: 3030,
  paidCents: 3030,
  vatNote: null,
};

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // Dynamically imported (not a static top-level import) so this route's
  // react-dom/server usage doesn't get flagged as part of the app-wide
  // Server Component module graph.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const draft = await getOrCreateDraftInvoiceTemplate();
  const html =
    "<!DOCTYPE html>" +
    renderToStaticMarkup(<InvoiceDocument input={SAMPLE_INPUT} blocks={draft.blocks} logoDataUri={null} />);
  const pdfBase64 = await renderHtmlToPdfBase64(html);
  return NextResponse.json({ pdfBase64 });
}
