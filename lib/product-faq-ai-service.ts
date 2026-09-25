import "server-only";
import { prisma } from "@/lib/prisma";
import { ProductFaqAiError, type ProductFaqFactCard } from "@/lib/product-faq-ai";

function exactSourceText(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFC").trim() ?? "";
  return normalized || null;
}

export async function loadProductFaqFactCard(productId: string): Promise<ProductFaqFactCard> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      translations: { where: { locale: "nl" }, take: 1 },
      attributes: { where: { key: { in: ["ingredients", "allergens", "mayContainTraces"] } } },
      variants: { where: { isActive: true }, orderBy: { weightGrams: "asc" } },
      productCategories: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        include: { category: { include: { translations: { where: { locale: "nl" }, take: 1 } } } },
      },
    },
  });
  if (!product) throw new ProductFaqAiError("PRODUCT_NOT_FOUND", "Het product bestaat niet.", 404);
  const translation = product.translations[0];
  if (!translation) throw new ProductFaqAiError("NL_TRANSLATION_MISSING", "Dit product heeft geen Nederlandse vertaling.", 422);
  const attributeMap = new Map(product.attributes.map((attribute) => [attribute.key, attribute.value]));
  return {
    productName: translation.name,
    categoryName: product.productCategories[0]?.category.translations[0]?.name ?? null,
    ingredients: exactSourceText(attributeMap.get("ingredients")),
    allergens: exactSourceText(attributeMap.get("allergens")),
    mayContainTraces: exactSourceText(attributeMap.get("mayContainTraces")),
    variants: product.variants.map((variant) => ({
      weightGrams: variant.weightGrams,
      preparation: variant.preparation,
      salting: variant.salting,
      coating: variant.coating,
    })),
  };
}
