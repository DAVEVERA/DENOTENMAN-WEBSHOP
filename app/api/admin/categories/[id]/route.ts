import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { revalidateCategoryStorefront } from "@/lib/category-revalidation";
import {
  buildCategoryIndexNowUrls,
  scheduleIndexNowUrls,
} from "@/lib/indexnow";
import { BASE_URL } from "@/lib/routes";

type PatchBody = Partial<{
  name: unknown;
  description: unknown;
  sortOrder: unknown;
  isActive: unknown;
  parentId: unknown;
}>;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const categoryData: {
    sortOrder?: number;
    isActive?: boolean;
    parentId?: string | null;
  } = {};
  const translationData: { name?: string; description?: string | null } = {};

  if ("name" in body) {
    const value = body.name;
    if (typeof value !== "string" || value.trim().length === 0) {
      return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    }
    translationData.name = value.trim();
  }

  if ("description" in body) {
    const value = body.description;
    if (value !== null && typeof value !== "string") {
      return NextResponse.json({ error: "INVALID_DESCRIPTION" }, { status: 400 });
    }
    const trimmed = typeof value === "string" ? value.trim() : null;
    translationData.description = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if ("sortOrder" in body) {
    const value = body.sortOrder;
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
      return NextResponse.json({ error: "INVALID_SORT_ORDER" }, { status: 400 });
    }
    categoryData.sortOrder = value;
  }

  if ("isActive" in body) {
    const value = body.isActive;
    if (typeof value !== "boolean") {
      return NextResponse.json({ error: "INVALID_IS_ACTIVE" }, { status: 400 });
    }
    categoryData.isActive = value;
  }

  if ("parentId" in body) {
    const value = body.parentId;
    if (value !== null && typeof value !== "string") {
      return NextResponse.json({ error: "INVALID_PARENT" }, { status: 400 });
    }
    if (value === id) {
      return NextResponse.json({ error: "SELF_PARENT" }, { status: 400 });
    }
    if (value !== null) {
      const parent = await prisma.category.findUnique({ where: { id: value } });
      if (!parent) {
        return NextResponse.json({ error: "PARENT_NOT_FOUND" }, { status: 400 });
      }
    }
    categoryData.parentId = value;
  }

  const hasCategoryUpdate = Object.keys(categoryData).length > 0;
  const hasTranslationUpdate = Object.keys(translationData).length > 0;

  if (!hasCategoryUpdate && !hasTranslationUpdate) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (hasCategoryUpdate) {
      await tx.category.update({ where: { id }, data: categoryData });
    } else {
      // Translation-only edits are still meaningful storefront changes and
      // must advance the parent timestamp used by category sitemaps.
      await tx.category.update({ where: { id }, data: { updatedAt: new Date() } });
    }
    if (hasTranslationUpdate) {
      await tx.categoryTranslation.updateMany({
        where: { categoryId: id, locale: "nl" },
        data: translationData,
      });
    }

    const after = await tx.category.findUnique({ where: { id } });
    await recordAudit(tx, admin, "Category", id, "UPDATE", existing, after);

    return tx.category.findUnique({ where: { id }, include: { translations: true } });
  });
  const revalidation = revalidateCategoryStorefront(id);
  if (updated) {
    scheduleIndexNowUrls(buildCategoryIndexNowUrls({
      baseUrl: BASE_URL,
      translations: updated.translations,
    }));
  }

  return NextResponse.json({
    ok: true,
    category: updated,
    frontendSynced: revalidation.frontendSynced,
  });
}
