import type { CopywriterNutritionFieldName, CopywriterProviderOutput } from "../lib/design-studio/copywriter/schema";

type NutritionFields = Pick<CopywriterProviderOutput["fields"], CopywriterNutritionFieldName>;

const missing = (path: string) => ({
  sourceStatus: "MISSING_VERIFIED_SOURCE" as const,
  proposed: null,
  applyAllowed: false as const,
  reason: "Een bron voor deze voedingswaarde ontbreekt.",
  evidencePaths: [path],
});

/** The nine nutrition fields, all without a value, for provider-output fixtures. */
export function missingNutrition(): NutritionFields {
  return {
    nutritionEnergyKj: missing("nutrition.energyKj"),
    nutritionEnergyKcal: missing("nutrition.energyKcal"),
    nutritionFat: missing("nutrition.fat"),
    nutritionSaturatedFat: missing("nutrition.saturatedFat"),
    nutritionCarbohydrates: missing("nutrition.carbohydrates"),
    nutritionSugars: missing("nutrition.sugars"),
    nutritionFiber: missing("nutrition.fiber"),
    nutritionProtein: missing("nutrition.protein"),
    nutritionSalt: missing("nutrition.salt"),
  };
}

/** Stored nutrition values per 100 g (almonds), as product attributes. */
export function nutritionAttributes(): Array<{ key: string; value: string }> {
  return [
    { key: "nutrition.energyKj", value: "2567" },
    { key: "nutrition.energyKcal", value: "620" },
    { key: "nutrition.fat", value: "53" },
    { key: "nutrition.saturatedFat", value: "4,1" },
    { key: "nutrition.carbohydrates", value: "5,4" },
    { key: "nutrition.sugars", value: "4,4" },
    { key: "nutrition.fiber", value: "11" },
    { key: "nutrition.protein", value: "25" },
    { key: "nutrition.salt", value: "0,01" },
  ];
}

const nutritionFieldByKey: Record<string, CopywriterNutritionFieldName> = {
  "nutrition.energyKj": "nutritionEnergyKj",
  "nutrition.energyKcal": "nutritionEnergyKcal",
  "nutrition.fat": "nutritionFat",
  "nutrition.saturatedFat": "nutritionSaturatedFat",
  "nutrition.carbohydrates": "nutritionCarbohydrates",
  "nutrition.sugars": "nutritionSugars",
  "nutrition.fiber": "nutritionFiber",
  "nutrition.protein": "nutritionProtein",
  "nutrition.salt": "nutritionSalt",
};

/** Proposal fields that copy the stored values of nutritionAttributes() exactly. */
export function exactNutrition(): NutritionFields {
  return Object.fromEntries(nutritionAttributes().map(({ key, value }) => [nutritionFieldByKey[key], {
    sourceStatus: "SOURCE_EXACT" as const,
    proposed: value,
    applyAllowed: true as const,
    reason: "Exact uit de productdata.",
    evidencePaths: [key],
  }])) as NutritionFields;
}
