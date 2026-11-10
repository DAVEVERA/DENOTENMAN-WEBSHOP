export const HOME_CATEGORY_ENTRANCES = [
  {
    canonicalSlug: "noten",
    previewSku: "MIX-3002-250-P",
    previewImageStorageKey:
      "products/gemengde-noten-gezouten/50d183ce-7cbd-40e1-87ba-df9c05c4bad4.png",
  },
  {
    canonicalSlug: "gedroogd-fruit",
    previewSku: "FRU-4020-250-P",
    previewImageStorageKey:
      "products/zure-abrikozen/d8c23cd8-f724-49f0-8b71-f710ab9933d9.png",
  },
  {
    canonicalSlug: "chocolade-zoet",
    previewSku: "CHO-5030-350-P",
    previewImageStorageKey:
      "products/chocolade-notenmix/92d9616d-6406-4b6c-977f-6ed8b3a5c9f1.png",
  },
  {
    canonicalSlug: "pitten-zaden",
    previewSku: "PIT-7006-250-P",
    previewImageStorageKey:
      "products/salademix/4c07f579-e0c4-4736-a358-993caca1c588.png",
  },
  {
    canonicalSlug: "snacks-zoutjes",
    previewSku: "SNK-6007-250-P",
    previewImageStorageKey:
      "products/gemengd-pikant/fe51e4cc-25de-4aac-8bc3-e23466b7c3f2.png",
  },
  {
    canonicalSlug: "bakproducten",
    previewSku: "BAK-9014-200-P",
    previewImageStorageKey:
      "products/cassata-gemengde-vruchten/f71608ad-ca91-43a5-94ab-30ee187bb5df.png",
  },
] as const;

export type HomeCategoryEntranceSlug =
  (typeof HOME_CATEGORY_ENTRANCES)[number]["canonicalSlug"];

export const HOME_CATEGORY_PREVIEW_SKUS = Object.fromEntries(
  HOME_CATEGORY_ENTRANCES.map(({ canonicalSlug, previewSku }) => [
    canonicalSlug,
    previewSku,
  ]),
) as Record<HomeCategoryEntranceSlug, string>;
