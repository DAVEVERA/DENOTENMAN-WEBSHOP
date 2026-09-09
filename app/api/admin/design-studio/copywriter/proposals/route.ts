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
  copywriterGenerateRequestSchema,
  createCopywriterProposal,
} from "@/lib/design-studio/copywriter/service";

export const runtime = "nodejs";

export function createCopywriterProposalPostHandler(dependencies: {
  getAdminSession: (request: NextRequest) => Promise<CopywriterAdminIdentity | null>;
  hasSameOrigin: (request: NextRequest) => boolean;
  createProposal: typeof createCopywriterProposal;
}) {
  return async function post(request: NextRequest) {
    const admin = await dependencies.getAdminSession(request);
    if (!admin) return copywriterJson({ error: "UNAUTHORIZED" }, 401);
    if (!canUseCopywriter(admin)) return copywriterJson({ error: "FORBIDDEN" }, 403);
    if (!dependencies.hasSameOrigin(request)) return copywriterJson({ error: "INVALID_ORIGIN" }, 403);
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!validIdempotencyKey(idempotencyKey)) return copywriterJson({ error: "INVALID_IDEMPOTENCY_KEY" }, 422);
    const parsed = copywriterGenerateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return copywriterJson({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Controleer de invoer." }, 422);
    try {
      const result = await dependencies.createProposal({ adminUserId: admin.id, idempotencyKey, options: parsed.data });
      return copywriterJson(result, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCopywriterError(error);
    }
  };
}

export const POST = createCopywriterProposalPostHandler({ getAdminSession: copywriterAdminSession, hasSameOrigin, createProposal: createCopywriterProposal });
