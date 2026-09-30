import type { NextRequest } from "next/server";

import { developerErrorResponse, developerJson, requireAdmin } from "@/lib/developer-portal/http";
import { startDeveloperInvoiceCheckout } from "@/lib/developer-portal/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// De Notenman pays a developer invoice: returns the Stripe Checkout URL to open.
export async function POST(request: NextRequest, context: Context) {
  const guard = await requireAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return developerJson(await startDeveloperInvoiceCheckout((await context.params).id));
  } catch (error) {
    return developerErrorResponse(error);
  }
}
