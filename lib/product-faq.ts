import type { Locale, ProductFaqMediaType, ProductFaqPlacement, ProductFaqStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicStorageUrl } from "@/lib/storage";
import { FAQ_PLACEMENTS, sanitizeFaqHtml } from "@/lib/product-faq-schema";

type FaqTranslationDto = {
  locale: Locale;
  question: string;
  answerHtml: string;
  mediaLabel: string | null;
};

export type ProductFaqMediaDto = {
  id: string;
  type: ProductFaqMediaType;
  url: string;
  contentType: string;
  originalFilename: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  durationMs: number | null;
};

export type AdminProductFaqItemDto = {
  id: string;
  status: ProductFaqStatus;
  placement: ProductFaqPlacement;
  sortOrder: number;
  version: number;
  draft: { id: string; revision: number; translations: FaqTranslationDto[]; media: ProductFaqMediaDto | null } | null;
  published: { id: string; revision: number; translations: FaqTranslationDto[]; media: ProductFaqMediaDto | null } | null;
};

export type AdminProductFaqSetDto = { revision: number; items: AdminProductFaqItemDto[] };

function mediaDto(asset: {
  id: string; type: ProductFaqMediaType; storageKey: string; contentType: string; originalFilename: string;
  fileSize: number; width: number | null; height: number | null; pageCount: number | null; durationMs: number | null;
} | null): ProductFaqMediaDto | null {
  if (!asset) return null;
  try {
    return { id: asset.id, type: asset.type, url: publicStorageUrl(asset.storageKey), contentType: asset.contentType, originalFilename: asset.originalFilename, fileSize: asset.fileSize, width: asset.width, height: asset.height, pageCount: asset.pageCount, durationMs: asset.durationMs };
  } catch {
    return null;
  }
}

export async function getAdminProductFaqSet(productId: string): Promise<AdminProductFaqSetDto> {
  const set = await prisma.productFaqSet.findUnique({
    where: { productId },
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          draftRevision: { include: { translations: { orderBy: { locale: "asc" } }, mediaAsset: true } },
          publishedRevision: { include: { translations: { orderBy: { locale: "asc" } }, mediaAsset: true } },
        },
      },
    },
  });
  if (!set) return { revision: 0, items: [] };
  return {
    revision: set.aggregateRevision,
    items: set.items.map((item) => ({
      id: item.id,
      status: item.status,
      placement: item.placement,
      sortOrder: item.sortOrder,
      version: item.version,
      draft: item.draftRevision ? { id: item.draftRevision.id, revision: item.draftRevision.revision, translations: item.draftRevision.translations, media: mediaDto(item.draftRevision.mediaAsset) } : null,
      published: item.publishedRevision ? { id: item.publishedRevision.id, revision: item.publishedRevision.revision, translations: item.publishedRevision.translations, media: mediaDto(item.publishedRevision.mediaAsset) } : null,
    })),
  };
}

export type StorefrontProductFaq = {
  id: string;
  question: string;
  answerHtml: string;
  placement: ProductFaqPlacement;
  sortOrder: number;
  media: (ProductFaqMediaDto & { label: string }) | null;
};

export type StorefrontProductFaqs = Record<ProductFaqPlacement, StorefrontProductFaq[]>;

function emptyPlacements(): StorefrontProductFaqs {
  return Object.fromEntries(FAQ_PLACEMENTS.map((placement) => [placement, []])) as unknown as StorefrontProductFaqs;
}

async function legacyFaqs(productId: string, locale: Locale): Promise<StorefrontProductFaqs> {
  const rows = await prisma.productAttribute.findMany({
    where: { productId, key: { in: [
      `faq.1.question.${locale}`, `faq.1.answer.${locale}`,
      `faq.2.question.${locale}`, `faq.2.answer.${locale}`,
      "faq.1.question", "faq.1.answer", "faq.2.question", "faq.2.answer",
    ] } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const result = emptyPlacements();
  for (const index of [1, 2]) {
    const question = values.get(`faq.${index}.question.${locale}`) ?? values.get(`faq.${index}.question`);
    const answer = values.get(`faq.${index}.answer.${locale}`) ?? values.get(`faq.${index}.answer`);
    if (!question?.trim() || !answer?.trim()) continue;
    result.BELOW_PRODUCT_DETAILS.push({ id: `legacy-${productId}-${index}`, question: question.trim(), answerHtml: sanitizeFaqHtml(answer), placement: "BELOW_PRODUCT_DETAILS", sortOrder: index - 1, media: null });
  }
  return result;
}

/** Public read isolates failures and deliberately has no locale fallback. */
export async function getStorefrontProductFaqs(productId: string, locale: Locale): Promise<StorefrontProductFaqs> {
  try {
    const set = await prisma.productFaqSet.findUnique({
      where: { productId },
      select: {
        id: true,
        items: {
          where: { deletedAt: null, status: "PUBLISHED", publishedRevisionId: { not: null } },
          orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true, placement: true, sortOrder: true,
            publishedRevision: {
              select: {
                translations: { where: { locale }, select: { question: true, answerHtml: true, mediaLabel: true }, take: 1 },
                mediaAsset: true,
              },
            },
          },
        },
      },
    });
    if (!set) return legacyFaqs(productId, locale);
    const result = emptyPlacements();
    for (const item of set.items) {
      const translation = item.publishedRevision?.translations[0];
      if (!translation?.question.trim() || !translation.answerHtml.trim()) continue;
      const media = mediaDto(item.publishedRevision?.mediaAsset ?? null);
      result[item.placement].push({
        id: item.id,
        question: translation.question.trim(),
        answerHtml: sanitizeFaqHtml(translation.answerHtml),
        placement: item.placement,
        sortOrder: item.sortOrder,
        media: media && translation.mediaLabel?.trim() ? { ...media, label: translation.mediaLabel.trim() } : null,
      });
    }
    return result;
  } catch (error) {
    console.error("Product FAQ read failed; rendering without FAQ", { productId, error });
    return emptyPlacements();
  }
}
