import type { NextRequest } from "next/server";

import { developerErrorResponse, developerJson, readJson, requireDeveloper } from "@/lib/developer-portal/http";
import { createDeveloperInvoice, listDeveloperInvoices } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireDeveloper(request);
  if (guard.response) return guard.response;
  return developerJson({ invoices: await listDeveloperInvoices() });
}

export async function POST(request: NextRequest) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return developerJson({ invoice: await createDeveloperInvoice(await readJson(request)) }, 201);
  } catch (error) {
    return developerErrorResponse(error);
  }
}
