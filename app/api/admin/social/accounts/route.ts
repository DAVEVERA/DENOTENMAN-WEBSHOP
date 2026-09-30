import type { NextRequest } from "next/server";

import { requireSocialAdmin, socialJson } from "@/lib/social/http";
import { connectionStatus, SOCIAL_CONNECTIONS } from "@/lib/social/providers";
import { listSocialAccounts } from "@/lib/social/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireSocialAdmin(request);
  if (guard.response) return guard.response;
  return socialJson({ accounts: await listSocialAccounts(), connections: SOCIAL_CONNECTIONS.map(connectionStatus) });
}
