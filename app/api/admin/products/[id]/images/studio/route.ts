import { NextResponse, type NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import {
  buildStudioVersionKey,
  consumeStudioRateLimit,
  createOpenAIImageGateway,
  loadProductImageBytes,
  parseStudioRequest,
  prepareAIStudioEdit,
  ProductImageStudioError,
  runDeterministicStudioOperation,
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
  deleteProductImage,
  publicImageUrl,
  saveProductImage,
} from "@/lib/storage";

function clientKey(request: NextRequest, productId: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${productId}:${forwarded || "admin"}`;
}

function editPrompt(operation: "edit" | "spread" | "extend" | "fill", prompt: string): string {
  const invariant = operation === "fill"
    ? "Change only the transparent masked area; preserve every pixel outside it and keep the product identity unchanged."
    : operation === "extend"
      ? "Extend only the transparent canvas; preserve the original product, framing and pixels unchanged."
      : operation === "spread"
        ? "Redistribute only the visible product pieces with natural spacing; preserve their identity, count, colour, texture, packaging and the background."
      : "Preserve the product identity, packaging, labels, proportions and all details not explicitly requested.";
  return `${prompt}\n\nConstraints: ${invariant} No watermark.`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id: productId } = await params;

  let storageKey: string | undefined;
  let stored = false;
  try {
    const studioRequest = parseStudioRequest(await request.json().catch(() => null));
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true },
    });
    if (!product) throw new ProductImageStudioError("NOT_FOUND", "Product niet gevonden.", 404);

    const sourceImageId = "sourceImageId" in studioRequest ? studioRequest.sourceImageId : undefined;
    const sourceImage = sourceImageId
      ? await prisma.productImage.findFirst({ where: { id: sourceImageId, productId } })
      : null;
    if (sourceImageId && !sourceImage) {
      throw new ProductImageStudioError("NOT_FOUND", "De bronafbeelding bestaat niet bij dit product.", 404);
    }

    let output: Buffer;
    let requestId: string | null = null;
    if (studioRequest.operation === "generate") {
      consumeStudioRateLimit(clientKey(request, productId));
      const generated = await createOpenAIImageGateway().generate(studioRequest);
      output = generated.bytes;
      requestId = generated.requestId;
    } else {
      if (!sourceImage) throw new ProductImageStudioError("NOT_FOUND", "De bronafbeelding bestaat niet.", 404);
      const source = await loadProductImageBytes(sourceImage.storageKey);
      if (studioRequest.operation === "edit" || studioRequest.operation === "spread" || studioRequest.operation === "extend" || studioRequest.operation === "fill") {
        consumeStudioRateLimit(clientKey(request, productId));
        const prepared = await prepareAIStudioEdit(studioRequest, source);
        const edited = await createOpenAIImageGateway().edit({
          ...prepared,
          prompt: editPrompt(studioRequest.operation, prepared.prompt),
        });
        output = edited.bytes;
        requestId = edited.requestId;
      } else {
        output = (await runDeterministicStudioOperation(studioRequest, source)).bytes;
      }
    }

    await validateStudioImage(output);
    storageKey = buildStudioVersionKey(product.slug, studioRequest.operation, sourceImage?.id);
    await saveProductImage(storageKey, output, "image/png");
    stored = true;

    const image = await prisma.$transaction(async (tx) => {
      await lockProductImages(tx, productId);
      const current = await getOrderedProductImages(tx, productId);
      return tx.productImage.create({
        data: {
          productId,
          storageKey: storageKey!,
          alt: sourceImage?.alt ?? null,
          sortOrder: current.length,
          isPrimary: current.length === 0,
        },
      });
    }, productImageTransactionOptions);

    await revalidateProductImageStorefront(productId);
    return NextResponse.json({
      ok: true,
      operation: studioRequest.operation,
      versionOf: sourceImage?.id ?? null,
      requestId,
      image: { ...image, url: publicImageUrl(image.storageKey) },
    }, { status: 201 });
  } catch (error) {
    if (stored && storageKey) {
      await deleteProductImage(storageKey).catch((cleanupError) => {
        console.error("Failed to clean up studio output after database failure", { productId, storageKey, cleanupError });
      });
    }
    const mapped = toStudioErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
