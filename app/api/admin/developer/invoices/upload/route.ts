import type { NextRequest } from "next/server";

import { UPLOAD_MAX_BYTES } from "@/lib/developer-portal/extract";
import { developerErrorResponse, developerJson, requireDeveloper } from "@/lib/developer-portal/http";
import { createDeveloperInvoiceFromUpload } from "@/lib/developer-portal/service";

export const runtime = "nodejs";
export const maxDuration = 120;

// One invoice file per request: the AI reads it and a draft is created to check.
export async function POST(request: NextRequest) {
  const guard = await requireDeveloper(request, { write: true });
  if (guard.response) return guard.response;
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return developerJson({ error: "NO_FILE", message: "Kies een factuurbestand." }, 422);
    if (file.size > UPLOAD_MAX_BYTES) return developerJson({ error: "FILE_SIZE", message: "Een factuur mag maximaal 10 MB zijn." }, 422);
    const bytes = Buffer.from(await file.arrayBuffer());
    return developerJson(await createDeveloperInvoiceFromUpload({ filename: file.name, contentType: file.type, bytes }), 201);
  } catch (error) {
    return developerErrorResponse(error);
  }
}
