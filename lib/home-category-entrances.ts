export const HOME_CATEGORY_ENTRANCES = [
  { canonicalSlug: "noten", previewSku: "MIX-3003-250-P" },
  { canonicalSlug: "gedroogd-fruit", previewSku: "FRU-4018-250-P" },
  { canonicalSlug: "chocolade-zoet", previewSku: "CHO-5014-250-P" },
  { canonicalSlug: "pitten-zaden", previewSku: "PIT-7008-250-P" },
  { canonicalSlug: "snacks-zoutjes", previewSku: "SNK-6007-250-P" },
  { canonicalSlug: "bakproducten", previewSku: "BAK-9014-200-P" },
] as const;

export type HomeCategoryEntranceSlug =
  (typeof HOME_CATEGORY_ENTRANCES)[number]["canonicalSlug"];

export const HOME_CATEGORY_PREVIEW_SKUS = Object.fromEntries(
  HOME_CATEGORY_ENTRANCES.map(({ canonicalSlug, previewSku }) => [
    canonicalSlug,
    previewSku,
  ]),
) as Record<HomeCategoryEntranceSlug, string>;
