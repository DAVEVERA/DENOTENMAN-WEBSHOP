import { createApiClient } from "@denotenman/api-client";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export function serverApiClient() {
  return createApiClient({ baseUrl: `${API_URL}/v1` });
}
