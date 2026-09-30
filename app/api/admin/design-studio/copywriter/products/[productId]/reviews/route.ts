import type { NextRequest } from "next/server";

import { hasSameOrigin } from "@/lib/design-studio/http";
import {
  canUseCopywriter,
  copywriterAdminSession,
  copywriterJson,
  mapCopywriterError,
  type CopywriterAdminIdentity,
} from "@/lib/design-studio/copywriter/http";
import {
  acceptCopywriterField,
  copywriterAcceptFieldRequestSchema,
} from "@/lib/design-studio/copywriter/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ productId: string }> };

// Keeps a review-flagged field as is. Repeating the request stores the same result,
// so no idempotency key is needed.
export function createCopywriterFieldReviewPostHandler(dependencies: {
  getAdminSession: (request: NextRequest) => Promise<CopywriterAdminIdentity | null>;
  hasSameOrigin: (request: NextRequest) => boolean;
  acceptField: typeof acceptCopywriterField;
}) {
  return async function post(request: NextRequest, context: Context) {
    const admin = await dependencies.getAdminSession(request);
    if (!admin) return copywriterJson({ error: "UNAUTHORIZED" }, 401);
    if (!canUseCopywriter(admin)) return copywriterJson({ error: "FORBIDDEN" }, 403);
    if (!dependencies.hasSameOrigin(request)) return copywriterJson({ error: "INVALID_ORIGIN" }, 403);
    const parsed = copywriterAcceptFieldRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return copywriterJson({ error: "INVALID_INPUT", message: "Kies een geldig veld." }, 422);
    const { productId } = await context.params;
    try {
      return copywriterJson(await dependencies.acceptField({ adminUserId: admin.id, productId, field: parsed.data.field }));
    } catch (error) {
      return mapCopywriterError(error);
    }
  };
}

export const POST = createCopywriterFieldReviewPostHandler({
  getAdminSession: copywriterAdminSession,
  hasSameOrigin,
  acceptField: acceptCopywriterField,
});
