/**
 * Deliberate, editable homepage selections. Stable SKUs keep each compact
 * category row varied; the server query still verifies active category,
 * translation and variant membership before a product can be shown.
 */
export const HOME_NUT_PRODUCT_SKUS = [
  "NOT-1010-250-P",
  "NOT-1015-250-P",
  "MIX-3003-250-P",
  "NOT-1006-100-P",
  "NOT-1003-200-P",
  "NOT-1008-200-P",
] as const;

export const HOME_HONEY_PRODUCT_SKUS = [
  "NAT-10003-350-P",
  "NAT-10005-450-P",
  "NAT-10010-900-P",
  "NAT-10011-350-P",
  "NAT-10019-350-P",
  "NAT-10020-250-P",
] as const;
