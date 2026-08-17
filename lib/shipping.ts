export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 495;

export function postnlTrackingUrl(trackingCode: string, postalCode: string, country: string): string {
  return `https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(trackingCode)}-${encodeURIComponent(country)}-${encodeURIComponent(postalCode.replace(/\s+/g, ""))}`;
}
