import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import {
  ProductImageStudioError,
  StudioValidationError,
  toStudioErrorResponse,
  validateStudioImage,
} from "@/lib/product-image-studio";
import {
  getOrderedProductImages,
  lockProductImages,
  productImageTransactionOptions,
} from "@/lib/product-image-studio-db";
import { revalidateProductImageStorefront } from "@/lib/product-image-revalidation";
import {
  buildProductImageKey,
  deleteProductImage,
  hasValidImageSignature,
  isAllowedContentType,
  publicImageUrl,
  saveProductImage,
} from "@/lib/storage";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function errorResponse(error: unknown) {
  const mapped = toStudioErrorResponse(error);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "NOT_FOUND", message: "Product niet gevonden." }, { status: 404 });
  const images = await prisma.productImage.findMany({
    where: { productId: id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({
    images: images.map((image) => ({ ...image, url: publicImageUrl(image.storageKey) })),
    expectedImageIds: images.map((image) => image.id),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!product) return NextResponse.json({ error: "NOT_FOUND", message: "Product niet gevonden." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const alt = form?.get("alt");
  if (!(file instanceof File) || !isAllowedContentType(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "INVALID_IMAGE", message: "Gebruik JPG, PNG, WebP of AVIF van maximaal 8 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(bytes, file.type)) {
    return NextResponse.json({ error: "INVALID_IMAGE_SIGNATURE", message: "De bestandsinhoud komt niet overeen met het gekozen afbeeldingsformaat." }, { status: 400 });
  }

  try {
    await validateStudioImage(bytes);
  } catch (error) {
    return errorResponse(error);
  }

  const storageKey = buildProductImageKey(product.slug, file.name);
  let stored = false;
  try {
    await saveProductImage(storageKey, bytes, file.type);
    stored = true;
    const image = await prisma.$transaction(async (tx) => {
      await lockProductImages(tx, id);
      const current = await getOrderedProductImages(tx, id);
      return tx.productImage.create({
        data: {
          productId: id,
          storageKey,
          alt: typeof alt === "string" ? alt.trim() || null : null,
          sortOrder: current.length,
          isPrimary: current.length === 0,
        },
      });
    }, productImageTransactionOptions);
    revalidateProductImageStorefront();
    return NextResponse.json({ ok: true, image: { ...image, url: publicImageUrl(image.storageKey) } }, { status: 201 });
  } catch (error) {
    if (stored) {
      await deleteProductImage(storageKey).catch((cleanupError) => {
        console.error("Failed to clean up product image after database failure", { productId: id, storageKey, cleanupError });
      });
    }
    console.error(`Failed to upload image for product ${id}`, error);
    if (error instanceof ProductImageStudioError || error instanceof StudioValidationError) return errorResponse(error);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: "De afbeelding kon niet veilig worden opgeslagen." }, { status: 502 });
  }
}
