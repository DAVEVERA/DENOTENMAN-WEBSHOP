import type { NextRequest } from "next/server";
import { z } from "zod";

import { developerErrorResponse, developerJson, getDeveloperAdmin, readJson, requireAdmin } from "@/lib/developer-portal/http";
import { recordDeveloperInvoiceView } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["OVERVIEW", "INVOICE"]),
  invoiceId: z.string().min(1).max(40).nullish(),
  screen: z.object({
    width: z.number().int().min(100).max(10_000),
    height: z.number().int().min(100).max(10_000),
    pixelRatio: z.number().min(0.5).max(6),
  }).nullish(),
  hints: z.object({
    model: z.string().max(80).nullish(),
    platformVersion: z.string().max(40).nullish(),
  }).nullish(),
}).strict();

// The invoice pages report a visit with the screen size, so the developer can see which
// device De Notenman used. The developer's own visits are not recorded.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    if (await getDeveloperAdmin(request)) return developerJson({ recorded: false });
    const input = schema.parse(await readJson(request));
    if (input.kind === "INVOICE" && !input.invoiceId) return developerJson({ error: "INVALID_INPUT", message: "Factuur ontbreekt." }, 422);
    const recorded = await recordDeveloperInvoiceView({
      kind: input.kind,
      adminUserId: guard.admin.id,
      invoiceId: input.kind === "INVOICE" ? input.invoiceId : null,
      client: {
        userAgent: request.headers.get("user-agent"),
        forwardedFor: request.headers.get("x-forwarded-for"),
        screen: input.screen ?? null,
        hints: input.hints ?? null,
      },
    });
    return developerJson({ recorded });
  } catch (error) {
    return developerErrorResponse(error);
  }
}
