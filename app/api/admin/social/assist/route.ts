import type { NextRequest } from "next/server";

import { suggestSocialCaptions } from "@/lib/social/assist";
import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";

export const runtime = "nodejs";

// "Verbeter met AI": returns suggestions only; nothing is stored.
export async function POST(request: NextRequest) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson(await suggestSocialCaptions(await request.json().catch(() => null)));
  } catch (error) {
    return socialErrorResponse(error);
  }
}
