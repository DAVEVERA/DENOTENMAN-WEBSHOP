export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 495;

export const SHIPPING_COUNTRY_CODES = ["NL", "BE"] as const;
export type ShippingCountryCode = (typeof SHIPPING_COUNTRY_CODES)[number];

export const STANDARD_HANDLING_DAYS = { min: 0, max: 1 } as const;
export const STANDARD_TRANSIT_DAYS = { min: 1, max: 2 } as const;
export const SHIPPING_BUSINESS_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export const RETURN_WINDOW_DAYS = 14;
export const RETURN_COUNTRY_CODES = SHIPPING_COUNTRY_CODES;
export const RETURN_POLICY_COUNTRY = "NL" as const;

export function postnlTrackingUrl(trackingCode: string, postalCode: string, country: string): string {
  return `https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(trackingCode)}-${encodeURIComponent(country)}-${encodeURIComponent(postalCode.replace(/\s+/g, ""))}`;
}
