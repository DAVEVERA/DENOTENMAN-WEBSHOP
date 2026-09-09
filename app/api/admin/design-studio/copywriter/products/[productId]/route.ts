import type { NextRequest } from "next/server";

import {
  canUseCopywriter,
  copywriterAdminSession,
  copywriterJson,
  mapCopywriterError,
  type CopywriterAdminIdentity,
} from "@/lib/design-studio/copywriter/http";
import { getCopywriterProduct } from "@/lib/design-studio/copywriter/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ productId: string }> };

export function createCopywriterProductGetHandler(dependencies: {
  getAdminSession: (request: NextRequest) => Promise<CopywriterAdminIdentity | null>;
  getProduct: typeof getCopywriterProduct;
}) {
  return async function get(request: NextRequest, context: Context) {
    const admin = await dependencies.getAdminSession(request);
    if (!admin) return copywriterJson({ error: "UNAUTHORIZED" }, 401);
    if (!canUseCopywriter(admin)) return copywriterJson({ error: "FORBIDDEN" }, 403);
    if ((request.nextUrl.searchParams.get("locale") ?? "nl") !== "nl") {
      return copywriterJson({ error: "INVALID_INPUT", message: "De CopyWriter ondersteunt alleen Nederlands." }, 422);
    }
    const { productId } = await context.params;
    try {
      return copywriterJson(await dependencies.getProduct({ adminUserId: admin.id, productId }));
    } catch (error) {
      return mapCopywriterError(error);
    }
  };
}

export const GET = createCopywriterProductGetHandler({ getAdminSession: copywriterAdminSession, getProduct: getCopywriterProduct });
