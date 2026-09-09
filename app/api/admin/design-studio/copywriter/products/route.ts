import type { NextRequest } from "next/server";

import {
  canUseCopywriter,
  copywriterAdminSession,
  copywriterJson,
  mapCopywriterError,
  type CopywriterAdminIdentity,
} from "@/lib/design-studio/copywriter/http";
import { listCopywriterProducts } from "@/lib/design-studio/copywriter/service";

export const runtime = "nodejs";

export function createCopywriterProductsGetHandler(dependencies: {
  getAdminSession: (request: NextRequest) => Promise<CopywriterAdminIdentity | null>;
  listProducts: (limit: number) => Promise<unknown[]>;
}) {
  return async function get(request: NextRequest) {
    const admin = await dependencies.getAdminSession(request);
    if (!admin) return copywriterJson({ error: "UNAUTHORIZED" }, 401);
    if (!canUseCopywriter(admin)) return copywriterJson({ error: "FORBIDDEN" }, 403);
    if ((request.nextUrl.searchParams.get("locale") ?? "nl") !== "nl") {
      return copywriterJson({ error: "INVALID_INPUT", message: "De CopyWriter ondersteunt alleen Nederlands." }, 422);
    }
    const requested = Number(request.nextUrl.searchParams.get("limit") ?? 250);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(500, Math.trunc(requested))) : 250;
    try {
      return copywriterJson({ products: await dependencies.listProducts(limit) });
    } catch (error) {
      return mapCopywriterError(error);
    }
  };
}

export const GET = createCopywriterProductsGetHandler({ getAdminSession: copywriterAdminSession, listProducts: listCopywriterProducts });
