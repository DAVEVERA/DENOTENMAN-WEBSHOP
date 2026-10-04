import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import {
  createNewsletterVideoThumbnail,
  VIDEO_THUMBNAIL_ASPECTS,
  VideoThumbnailError,
} from "@/lib/newsletter/video-thumbnail";

export const runtime = "nodejs";

const inputSchema = z.object({
  videoUrl: z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u),
  /** An uploaded still; not needed for YouTube videos. */
  imageUrl: z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u).optional(),
  aspect: z.enum(VIDEO_THUMBNAIL_ASPECTS).optional(),
}).strict();

// Email clients cannot play video, so a video block shows a still with a play button
// that links to the video. This bakes the play button into the still once.
export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Vul een geldige videolink in." }, { status: 422 });

  try {
    return NextResponse.json(await createNewsletterVideoThumbnail(parsed.data), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof VideoThumbnailError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    console.error("Newsletter video thumbnail failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "THUMBNAIL_FAILED", message: "De miniatuur kon niet worden gemaakt. Probeer het opnieuw." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
