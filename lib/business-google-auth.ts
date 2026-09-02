import "server-only";

import { google } from "googleapis";
import { BASE_URL } from "@/lib/routes";

/**
 * A separate OAuth 2.0 "Web application" client from the GOOGLE_ADS_*
 * credentials used elsewhere in this codebase — those are a service
 * integration with a pre-issued refresh token, not a consumer sign-in
 * consent-screen flow. This one needs its own Client ID/Secret, created in
 * Google Cloud Console with an authorized redirect URI matching
 * googleBusinessRedirectUri() below.
 */
export function isGoogleBusinessLoginConfigured(): boolean {
  return Boolean(process.env.GOOGLE_BUSINESS_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET?.trim());
}

export function googleBusinessRedirectUri(): string {
  return new URL("/api/business/auth/google/callback", BASE_URL).toString();
}

function getClient() {
  const clientId = process.env.GOOGLE_BUSINESS_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_BUSINESS_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google-inloggen is niet geconfigureerd voor de zakelijke omgeving");
  }
  return { client: new google.auth.OAuth2(clientId, clientSecret, googleBusinessRedirectUri()), clientId };
}

export function buildGoogleBusinessAuthUrl(state: string): string {
  const { client } = getClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
}

export async function verifyGoogleBusinessAuthCode(code: string): Promise<{ email: string; emailVerified: boolean }> {
  const { client, clientId } = getClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google gaf geen id_token terug");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Google gaf geen e-mailadres terug");
  return { email: payload.email, emailVerified: Boolean(payload.email_verified) };
}
