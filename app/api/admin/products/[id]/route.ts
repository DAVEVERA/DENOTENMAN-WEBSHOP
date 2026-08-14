import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";

// Route Handlers live outside proxy.ts's matcher (`/((?!api|_next|.*\\..*).*)`
// deliberately excludes `/api/**`), so this endpoint must verify the admin
// session itself rather than relying on the proxy gate that protects the
// `/admin/**` pages.
async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return isValidAdminSessionToken(token);
}

type VariantPatch = {
  id: string;
  priceCents: number;
  stock: number;
};

type ProductPatchBody = {
  basePriceCents: number;
  isActive: boolean;
  translation: {
    name: string;
    description: string;
  };
  variants: VariantPatch[];
};

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateBody(
  value: unknown
): { data: ProductPatchBody } | { error: string; message: string } {
  if (!value || typeof value !== "object") {
    return { error: "INVALID_BODY", message: "Invalid request body" };
  }

  const candidate = value as Partial<ProductPatchBody>;

  if (!isNonNegativeInt(candidate.basePriceCents)) {
    return {
      error: "VALIDATION_ERROR",
      message: "basePriceCents must be a non-negative integer (cents)",
    };
  }

  if (typeof candidate.isActive !== "boolean") {
    return { error: "VALIDATION_ERROR", message: "isActive must be a boolean" };
  }

  const translation = candidate.translation;
  if (
    !translation ||
    typeof translation !== "object" ||
    typeof translation.name !== "string" ||
    translation.name.trim().length === 0 ||
    typeof translation.description !== "string" ||
    translation.description.trim().length === 0
  ) {
    return {
      error: "VALIDATION_ERROR",
      message: "translation.name and translation.description are required and must not be empty",
    };
  }

  if (!Array.isArray(candidate.variants)) {
    return { error: "VALIDATION_ERROR", message: "variants must be an array" };
  }

  const variants: VariantPatch[] = [];
  for (const item of candidate.variants) {
    const variantCandidate = item as Partial<VariantPatch> | null;
    if (
      !variantCandidate ||
      typeof variantCandidate !== "object" ||
      typeof variantCandidate.id !== "string" ||
      variantCandidate.id.length === 0 ||
      !isNonNegativeInt(variantCandidate.priceCents) ||
      !isNonNegativeInt(variantCandidate.stock)
    ) {
      return {
        error: "VALIDATION_ERROR",
        message:
          "Each variant requires an id, a non-negative integer priceCents, and a non-negative integer stock",
      };
    }
    variants.push({
      id: variantCandidate.id,
      priceCents: variantCandidate.priceCents,
      stock: variantCandidate.stock,
    });
  }

  return {
    data: {
      basePriceCents: candidate.basePriceCents,
      isActive: candidate.isActive,
      translation: {
        name: translation.name.trim(),
        description: translation.description.trim(),
      },
      variants,
    },
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY", message: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateBody(body);
  if ("error" in validated) {
    return NextResponse.json(validated, { status: 400 });
  }

  const { data } = validated;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { select: { id: true } },
      translations: { where: { locale: "nl" } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Product not found" }, { status: 404 });
  }

  if (product.translations.length === 0) {
    return NextResponse.json(
      {
        error: "TRANSLATION_NOT_FOUND",
        message: "Product has no Dutch translation to update",
      },
      { status: 409 }
    );
  }

  const knownVariantIds = new Set(product.variants.map((variant) => variant.id));
  for (const variant of data.variants) {
    if (!knownVariantIds.has(variant.id)) {
      return NextResponse.json(
        { error: "VARIANT_NOT_FOUND", message: `Variant not found on this product: ${variant.id}` },
        { status: 404 }
      );
    }
  }

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { basePriceCents: data.basePriceCents, isActive: data.isActive },
      }),
      prisma.productTranslation.update({
        where: { productId_locale: { productId: id, locale: "nl" } },
        data: { name: data.translation.name, description: data.translation.description },
      }),
      ...data.variants.map((variant) =>
        prisma.productVariant.update({
          where: { id: variant.id },
          data: { priceCents: variant.priceCents, stock: variant.stock },
        })
      ),
    ]);
  } catch (error) {
    console.error(`Failed to update product ${id}`, error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
