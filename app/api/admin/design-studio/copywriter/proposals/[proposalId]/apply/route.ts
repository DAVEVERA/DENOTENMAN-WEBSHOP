import type { NextRequest } from "next/server";

import { hasSameOrigin, validIdempotencyKey } from "@/lib/design-studio/http";
import {
  canUseCopywriter,
  copywriterAdminSession,
  copywriterJson,
  mapCopywriterError,
  type CopywriterAdminIdentity,
} from "@/lib/design-studio/copywriter/http";
import {
  applyCopywriterProposal,
  copywriterApplyRequestSchema,
} from "@/lib/design-studio/copywriter/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ proposalId: string }> };

export function createCopywriterApplyPostHandler(dependencies: {
  getAdminSession: (request: NextRequest) => Promise<CopywriterAdminIdentity | null>;
  hasSameOrigin: (request: NextRequest) => boolean;
  applyProposal: typeof applyCopywriterProposal;
}) {
  return async function post(request: NextRequest, context: Context) {
    const admin = await dependencies.getAdminSession(request);
    if (!admin) return copywriterJson({ error: "UNAUTHORIZED" }, 401);
    if (!canUseCopywriter(admin)) return copywriterJson({ error: "FORBIDDEN" }, 403);
    if (!dependencies.hasSameOrigin(request)) return copywriterJson({ error: "INVALID_ORIGIN" }, 403);
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!validIdempotencyKey(idempotencyKey)) return copywriterJson({ error: "INVALID_IDEMPOTENCY_KEY" }, 422);
    const parsed = copywriterApplyRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return copywriterJson({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Controleer de eindcontrole." }, 422);
    const { proposalId } = await context.params;
    try {
      const result = await dependencies.applyProposal({ adminUserId: admin.id, proposalId, idempotencyKey, options: parsed.data });
      return copywriterJson(result, 200);
    } catch (error) {
      return mapCopywriterError(error);
    }
  };
}

export const POST = createCopywriterApplyPostHandler({ getAdminSession: copywriterAdminSession, hasSameOrigin, applyProposal: applyCopywriterProposal });
