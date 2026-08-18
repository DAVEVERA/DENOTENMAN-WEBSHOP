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
