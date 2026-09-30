import type { NextRequest } from "next/server";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import { disconnectSocialAccount } from "@/lib/social/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    await disconnectSocialAccount((await context.params).id);
    return socialJson({ ok: true });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
