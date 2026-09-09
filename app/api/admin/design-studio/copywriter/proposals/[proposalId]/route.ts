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
  copywriterEditRequestSchema,
  editCopywriterProposal,
} from "@/lib/design-studio/copywriter/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ proposalId: string }> };

export function createCopywriterProposalPatchHandler(dependencies: {
  getAdminSession: (request: NextRequest) => Promise<CopywriterAdminIdentity | null>;
  hasSameOrigin: (request: NextRequest) => boolean;
  editProposal: typeof editCopywriterProposal;
}) {
  return async function patch(request: NextRequest, context: Context) {
    const admin = await dependencies.getAdminSession(request);
    if (!admin) return copywriterJson({ error: "UNAUTHORIZED" }, 401);
    if (!canUseCopywriter(admin)) return copywriterJson({ error: "FORBIDDEN" }, 403);
    if (!dependencies.hasSameOrigin(request)) return copywriterJson({ error: "INVALID_ORIGIN" }, 403);
    if (!validIdempotencyKey(request.headers.get("idempotency-key"))) return copywriterJson({ error: "INVALID_IDEMPOTENCY_KEY" }, 422);
    const parsed = copywriterEditRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return copywriterJson({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Controleer de bewerking." }, 422);
    const { proposalId } = await context.params;
    try {
      return copywriterJson({ proposal: await dependencies.editProposal({ adminUserId: admin.id, proposalId, edits: parsed.data.edits }) });
    } catch (error) {
      return mapCopywriterError(error);
    }
  };
}

export const PATCH = createCopywriterProposalPatchHandler({ getAdminSession: copywriterAdminSession, hasSameOrigin, editProposal: editCopywriterProposal });
