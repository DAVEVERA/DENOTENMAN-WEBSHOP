import type { NextRequest } from "next/server";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import { deleteSocialCampaign, saveSocialCampaign } from "@/lib/social/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson({ campaign: await saveSocialCampaign((await context.params).id, await request.json().catch(() => null)) });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

/** Deleting a campaign keeps its posts; they just lose the campaign label. */
export async function DELETE(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    await deleteSocialCampaign((await context.params).id);
    return socialJson({ ok: true });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
