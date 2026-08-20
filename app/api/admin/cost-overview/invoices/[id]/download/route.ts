import type { NextRequest } from "next/server";
import { getCostInvoiceDownload } from "@/lib/cost-overview";
import { readCostInvoice } from "@/lib/cost-invoice-storage";
import {
  authorizeCostRequest,
  costErrorResponse,
  costJson,
  isUuid,
} from "@/lib/cost-overview-http";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: Context) {
  const authorization = await authorizeCostRequest(request, false);
  if (authorization instanceof Response) return authorization;
  const { id } = await params;
  if (!isUuid(id)) return costJson({ error: "NOT_FOUND" }, 404);
  try {
    const invoice = await getCostInvoiceDownload(id);
    const bytes = await readCostInvoice(invoice.storageKey);
    if (bytes.length !== invoice.fileSize)
      return costJson({ error: "INVOICE_UNAVAILABLE" }, 502);
    const asciiName =
      invoice.originalFilename.replace(/[^A-Za-z0-9._-]+/g, "_") || "invoice";
    const encodedName = encodeURIComponent(invoice.originalFilename);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": invoice.contentType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return costErrorResponse(error);
  }
}
