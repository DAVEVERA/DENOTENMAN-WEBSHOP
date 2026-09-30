import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { socialErrorResponse, socialJson } from "@/lib/social/http";
import { processDueSocialPosts } from "@/lib/social/service";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called every 5 minutes by Cloud Scheduler: publishes every post whose time has come.
export async function POST(request: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET?.trim();
  if (!secret) return socialJson({ error: "NOT_CONFIGURED" }, 503);
  if (!authorized(request, secret)) return socialJson({ error: "UNAUTHORIZED" }, 401);
  try {
    return socialJson(await processDueSocialPosts());
  } catch (error) {
    return socialErrorResponse(error);
  }
}
