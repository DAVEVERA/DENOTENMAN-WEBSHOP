// Canva Connect API configuration. Uses a Canva *Connect* integration (client ID
// usually "OC-…") from https://www.canva.com/developers/integrations/connect-api,
// not an Apps SDK app ID.

export const CANVA_API_BASE = "https://api.canva.com/rest";
export const CANVA_AUTH_BASE = "https://www.canva.com/api";

/** Scopes the integration must have enabled in the Canva Developer Portal. */
export const CANVA_SCOPES = [
  "asset:read",
  "asset:write",
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "profile:read",
] as const;

export type CanvaConfig = {
  clientId: string;
  clientSecret: string;
  /** Must match a redirect URL registered for the integration. */
  redirectUri: string;
};

export const CANVA_CALLBACK_PATH = "/api/admin/canva/callback";
/** Register this as the return URL ("Return navigation") in the Developer Portal. */
export const CANVA_RETURN_PATH = "/admin/canva/terug";

export function canvaConfig(
  environment: Record<string, string | undefined> = process.env,
): CanvaConfig | null {
  const clientId = environment.CANVA_CLIENT_ID?.trim();
  const clientSecret = environment.CANVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const base = (environment.SITE_URL ?? "http://localhost:3000").replace(/\/+$/u, "");
  return {
    clientId,
    clientSecret,
    redirectUri: environment.CANVA_REDIRECT_URI?.trim() || `${base}${CANVA_CALLBACK_PATH}`,
  };
}

/** Preset sizes offered when starting a new design, in pixels. */
export const CANVA_DESIGN_SIZES = [
  { id: "newsletter-banner", label: "Nieuwsbriefbanner", width: 1200, height: 600 },
  { id: "newsletter-image", label: "Nieuwsbriefbeeld (16:9)", width: 1200, height: 675 },
  { id: "square", label: "Vierkant (Instagram)", width: 1080, height: 1080 },
  { id: "portrait", label: "Staand (4:5)", width: 1080, height: 1350 },
  { id: "story", label: "Story / Reel (9:16)", width: 1080, height: 1920 },
  { id: "product", label: "Productfoto", width: 1600, height: 1600 },
  { id: "a4", label: "A4-flyer", width: 2480, height: 3508 },
] as const;

export type CanvaDesignSizeId = (typeof CANVA_DESIGN_SIZES)[number]["id"];
