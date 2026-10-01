import type { NextRequest } from "next/server";
import { z } from "zod";

import { developerErrorResponse, developerJson, readJson, requireAdmin } from "@/lib/developer-portal/http";
import { startDeveloperInvoicesCheckout } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

const schema = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(15) }).strict();

// De Notenman pays several open invoices in one Stripe payment.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return developerJson(await startDeveloperInvoicesCheckout(schema.parse(await readJson(request)).ids, "overview"));
  } catch (error) {
    return developerErrorResponse(error);
  }
}
