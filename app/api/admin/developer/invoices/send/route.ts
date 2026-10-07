import type { NextRequest } from "next/server";
import { z } from "zod";

import { developerErrorResponse, developerJson, readJson, requireDeveloper } from "@/lib/developer-portal/http";
import { sendDeveloperInvoices } from "@/lib/developer-portal/service";

export const runtime = "nodejs";

const schema = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(15), notify: z.boolean().optional() }).strict();

// Sets several drafts ready at once: De Notenman gets one e-mail with the combined total.
export async function POST(request: NextRequest) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    const input = schema.parse(await readJson(request));
    return developerJson({ invoices: await sendDeveloperInvoices(input.ids, undefined, { notify: input.notify }) });
  } catch (error) {
    return developerErrorResponse(error);
  }
}
