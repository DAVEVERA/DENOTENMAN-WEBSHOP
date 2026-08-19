export const nutFamilySlugs = [
  "amandelen",
  "cashewnoten",
  "hazelnoten",
  "macadamias",
  "paranoten",
  "pecannoten",
  "walnoten",
  "pinda-s",
  "pistachenoten",
  "notenmixen",
] as const;

export type NutFamilySlug = (typeof nutFamilySlugs)[number];

const nutFamilyByProductSku: Readonly<Record<string, NutFamilySlug>> = {
  "NOT-1001-250-P": "paranoten",
  "NOT-1002-200-P": "pecannoten",
  "NOT-1003-200-P": "pecannoten",
  "NOT-1004-200-P": "pecannoten",
  "NOT-1005-VAR-P": "pistachenoten",
  "NOT-1006-100-P": "pistachenoten",
  "NOT-1007-250-P": "pistachenoten",
  "NOT-1008-200-P": "walnoten",
  "NOT-1009-1000-P": "walnoten",
  "NOT-1010-250-P": "amandelen",
  "NOT-1011-250-P": "amandelen",
  "NOT-1012-250-P": "amandelen",
  "NOT-1013-250-P": "amandelen",
  "NOT-1014-250-P": "cashewnoten",
  "NOT-1015-250-P": "cashewnoten",
  "NOT-1016-250-P": "cashewnoten",
  "NOT-1017-500-P": "cashewnoten",
  "NOT-1018-250-P": "hazelnoten",
  "NOT-1019-250-P": "hazelnoten",
  "NOT-1020-250-P": "hazelnoten",
  "NOT-1021-200-P": "macadamias",
  "NOT-1022-200-P": "macadamias",
  "NOT-1023-200-P": "macadamias",
};

export function getNutFamilyForProductSku(sku: string): NutFamilySlug | undefined {
  if (sku.startsWith("PIN-")) return "pinda-s";
  if (sku.startsWith("MIX-")) return "notenmixen";
  if (!sku.startsWith("NOT-")) return undefined;

  const family = nutFamilyByProductSku[sku];
  if (!family) {
    throw new Error(`Geen notenfamilie vastgelegd voor SKU ${sku}.`);
  }
  return family;
}

export const chocolateFamilySlugs = [
  "chocolade-amandelen",
  "chocolade-rotsjes",
  "chocolade-hazelnoten",
  "chocolade-pecannoten",
  "chocolade-pindas",
  "chocolade-rozijnen",
  "studenten-flikken",
] as const;

export type ChocolateFamilySlug = (typeof chocolateFamilySlugs)[number];
export type ChocolatePlacementSlug = ChocolateFamilySlug | "snoep-nougat";

const chocolatePlacementByProductSku: Readonly<Record<string, ChocolatePlacementSlug>> = {
  "CHO-5001-250-P": "snoep-nougat",
  "CHO-5002-250-P": "snoep-nougat",
  "CHO-5003-300-P": "snoep-nougat",
  "CHO-5004-250-P": "chocolade-amandelen",
  "CHO-5005-250-P": "chocolade-amandelen",
  "CHO-5006-250-P": "chocolade-amandelen",
  "CHO-5007-250-P": "chocolade-amandelen",
  "CHO-5008-250-P": "chocolade-amandelen",
  "CHO-5009-500-P": "snoep-nougat",
  "CHO-5010-250-P": "chocolade-rotsjes",
  "CHO-5011-250-P": "chocolade-rotsjes",
  "CHO-5012-250-P": "chocolade-rotsjes",
  "CHO-5013-250-P": "chocolade-rotsjes",
  "CHO-5014-250-P": "chocolade-rotsjes",
  "CHO-5015-250-P": "chocolade-rotsjes",
  "CHO-5016-250-P": "chocolade-rotsjes",
  "CHO-5017-VAR-P": "snoep-nougat",
  "CHO-5018-200-P": "snoep-nougat",
  "CHO-5019-180-P": "chocolade-hazelnoten",
  "CHO-5020-200-P": "chocolade-pecannoten",
  "CHO-5021-250-P": "chocolade-pindas",
  "CHO-5022-250-P": "chocolade-pindas",
  "CHO-5023-250-P": "chocolade-rozijnen",
  "CHO-5024-250-P": "chocolade-rozijnen",
  "CHO-5025-250-P": "chocolade-rozijnen",
  "CHO-5026-250-P": "chocolade-rozijnen",
  "CHO-5027-250-P": "studenten-flikken",
  "CHO-5028-250-P": "studenten-flikken",
  "CHO-5029-250-P": "studenten-flikken",
};

export function getChocolatePlacementForProductSku(
  sku: string
): ChocolatePlacementSlug | undefined {
  return chocolatePlacementByProductSku[sku];
}

export const seedPlacementSlugs = [
  "pompoenpitten",
  "zonnebloempitten",
  "pijnboompitten",
  "lijnzaad",
  "sesamzaad",
  "chiazaad",
  "hennepzaad",
  "maanzaad",
  "zadenmixen-granen",
] as const;

export type SeedPlacementSlug = (typeof seedPlacementSlugs)[number];

const seedPlacementByProductSku: Readonly<Record<string, SeedPlacementSlug>> = {
  "PIT-7001-250-P": "lijnzaad",
  "PIT-7002-250-P": "lijnzaad",
  "PIT-7003-100-P": "pijnboompitten",
  "PIT-7004-250-P": "pompoenpitten",
  "PIT-7005-500-P": "zadenmixen-granen",
  "PIT-7006-250-P": "zadenmixen-granen",
  "PIT-7007-250-P": "sesamzaad",
  "PIT-7008-250-P": "zadenmixen-granen",
  "PIT-7009-250-P": "zonnebloempitten",
  "PIT-7010-250-P": "chiazaad",
  "PIT-7011-250-P": "hennepzaad",
  "PIT-7012-250-P": "sesamzaad",
  "PIT-7013-VAR-P": "maanzaad",
};

export function getSeedPlacementForProductSku(
  sku: string
): SeedPlacementSlug | undefined {
  if (!sku.startsWith("PIT-")) return undefined;
  const placement = seedPlacementByProductSku[sku];
  if (!placement) {
    throw new Error(`Geen pitten- of zadenfamilie vastgelegd voor SKU ${sku}.`);
  }
  return placement;
}
