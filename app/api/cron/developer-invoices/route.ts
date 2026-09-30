import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { developerErrorResponse, developerJson } from "@/lib/developer-portal/http";
import { processDeveloperInvoiceReminders } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const secret = process.env.DEVELOPER_INVOICE_CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called daily by Cloud Scheduler: confirms Stripe payments and sends due reminders.
export async function POST(request: NextRequest) {
  if (!process.env.DEVELOPER_INVOICE_CRON_SECRET?.trim()) return developerJson({ error: "NOT_CONFIGURED" }, 503);
  if (!authorized(request)) return developerJson({ error: "UNAUTHORIZED" }, 401);
  try {
    return developerJson(await processDeveloperInvoiceReminders());
  } catch (error) {
    return developerErrorResponse(error);
  }
}
