import type { NextRequest } from "next/server";

import { eurRateFor, isForeignCurrency } from "@/lib/developer-portal/fx";
import { developerErrorResponse, developerJson, requireDeveloper } from "@/lib/developer-portal/http";

export const runtime = "nodejs";

// The ECB rate for a currency and date, for converting dollar amounts in the invoice editor.
export async function GET(request: NextRequest) {
  const guard = await requireDeveloper(request);
  if (guard.response) return guard.response;
  const currency = request.nextUrl.searchParams.get("currency") ?? "";
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!isForeignCurrency(currency)) return developerJson({ error: "CURRENCY", message: "Onbekende valuta." }, 422);
  try {
    return developerJson(await eurRateFor("USD", date));
  } catch (error) {
    return developerErrorResponse(error);
  }
}
