export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 495;

export function postnlTrackingUrl(trackingCode: string, postalCode: string): string {
  return `https://jouw.postnl.nl/track-and-trace/${encodeURIComponent(trackingCode)}-NL-${encodeURIComponent(postalCode.replace(/\s+/g, ""))}`;
}
