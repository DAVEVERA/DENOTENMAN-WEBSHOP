import { isShippingCountryCode, type ShippingCountryCode } from "@/lib/shipping";

export const COUNTRY_PREFERENCE_COOKIE = "denotenman-country";
export const COUNTRY_PREFERENCE_LIFETIME_DAYS = 365;

export function parseCountryPreference(value: string | null | undefined): ShippingCountryCode | null {
  if (!value) return null;
  return isShippingCountryCode(value) ? value : null;
}
