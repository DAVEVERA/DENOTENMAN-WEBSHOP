import { after, NextResponse, type NextRequest } from "next/server";

import { developerErrorResponse, getDeveloperAdmin, requireAdmin } from "@/lib/developer-portal/http";
import { getDeveloperInvoiceAttachment, recordDeveloperInvoiceView } from "@/lib/developer-portal/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// The original invoice file. Admins see it once the invoice is set ready; the developer always.
export async function GET(request: NextRequest, context: Context) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;
  try {
    const developer = await getDeveloperAdmin(request);
    const id = (await context.params).id;
    const file = await getDeveloperInvoiceAttachment(id, { publishedOnly: !developer });
    if (!developer) {
      const adminUserId = guard.admin.id;
      after(() => recordDeveloperInvoiceView({ kind: "ATTACHMENT", adminUserId, invoiceId: id }).catch((error) => console.error("Developer invoice view not recorded", error)));
    }
    const safeName = file.filename.replace(/[^\w.\- ]+/gu, "_").slice(0, 120) || "factuur";
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "content-type": file.contentType,
        "content-disposition": `inline; filename="${safeName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
      },
    });
  } catch (error) {
    return developerErrorResponse(error);
  }
}
