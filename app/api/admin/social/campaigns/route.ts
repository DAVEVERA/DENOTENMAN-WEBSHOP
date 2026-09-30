import type { NextRequest } from "next/server";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import { listSocialCampaigns, saveSocialCampaign } from "@/lib/social/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireSocialAdmin(request);
  if (guard.response) return guard.response;
  return socialJson({ campaigns: await listSocialCampaigns() });
}

export async function POST(request: NextRequest) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson({ campaign: await saveSocialCampaign(null, await request.json().catch(() => null)) }, 201);
  } catch (error) {
    return socialErrorResponse(error);
  }
}
