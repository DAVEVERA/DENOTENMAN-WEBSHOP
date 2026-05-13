import { createApiClient } from "@denotenman/api-client";

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : (process.env.API_URL ?? "http://localhost:4000");

function getAccessToken(): string | null {
  try {
    return localStorage.getItem("dnm_access_token");
  } catch {
    return null;
  }
}

export const clientApi = createApiClient({
  baseUrl: `${API_URL}/v1`,
  getAccessToken,
});
