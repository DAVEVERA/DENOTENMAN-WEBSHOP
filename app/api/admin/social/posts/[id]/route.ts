import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireSocialAdmin, socialErrorResponse, socialJson } from "@/lib/social/http";
import {
  deleteSocialPost,
  duplicateSocialPost,
  getSocialPost,
  publishSocialPostNow,
  retrySocialPost,
  scheduleSocialPost,
  unscheduleSocialPost,
  updateSocialPost,
} from "@/lib/social/service";

export const runtime = "nodejs";
// Publishing a video can take a few minutes.
export const maxDuration = 900;
type Context = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publishNow") }).strict(),
  z.object({ action: z.literal("schedule"), scheduledAt: z.string().datetime() }).strict(),
  z.object({ action: z.literal("unschedule") }).strict(),
  z.object({ action: z.literal("retry") }).strict(),
  z.object({ action: z.literal("duplicate") }).strict(),
]);

export async function GET(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request);
  if (guard.response) return guard.response;
  try {
    return socialJson({ post: await getSocialPost((await context.params).id) });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    return socialJson({ post: await updateSocialPost((await context.params).id, await request.json().catch(() => null)) });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    const { id } = await context.params;
    const input = actionSchema.parse(await request.json().catch(() => null));
    const post = input.action === "publishNow"
      ? await publishSocialPostNow(id)
      : input.action === "schedule"
        ? await scheduleSocialPost(id, input.scheduledAt)
        : input.action === "unschedule"
          ? await unscheduleSocialPost(id)
          : input.action === "retry"
            ? await retrySocialPost(id)
            : await duplicateSocialPost(id, guard.admin.id);
    return socialJson({ post });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const guard = await requireSocialAdmin(request, { write: true });
  if (guard.response) return guard.response;
  try {
    await deleteSocialPost((await context.params).id);
    return socialJson({ ok: true });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
