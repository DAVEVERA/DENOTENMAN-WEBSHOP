import type { NextRequest } from "next/server";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import { createSocialPost, listSocialPosts } from "@/lib/social/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireSocialAdmin(request);
  if (guard.response) return guard.response;
  const from = new Date(request.nextUrl.searchParams.get("from") ?? "");
  const to = new Date(request.nextUrl.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 400 * 86_400_000) {
    return socialJson({ error: "INVALID_RANGE", message: "Ongeldige periode." }, 422);
  }
  return socialJson({ posts: await listSocialPosts({ from, to }) });
}

export async function POST(request: NextRequest) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson({ post: await createSocialPost(await request.json().catch(() => null), guard.admin.id) }, 201);
  } catch (error) {
    return socialErrorResponse(error);
  }
}
