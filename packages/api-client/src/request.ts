import type { z } from "zod";
import { ApiError } from "./errors.js";

export interface RequestOptions {
  baseUrl: string;
  path: string;
  method: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  getAccessToken?: () => Promise<string | null> | string | null;
  fetchImpl: typeof fetch;
}

export async function request<TOut>(schema: z.ZodType<TOut>, opts: RequestOptions): Promise<TOut> {
  const { baseUrl, path, method, body, query, getAccessToken, fetchImpl } = opts;

  let url = `${baseUrl}${path}`;
  if (query !== undefined) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs.length > 0) {
      url = `${url}?${qs}`;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (getAccessToken !== undefined) {
    const token = await getAccessToken();
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetchImpl(url, init);

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const errorBody: unknown = isJson ? await response.json().catch(() => null) : null;
    throw ApiError.fromResponse(response.status, errorBody);
  }

  if (response.status === 204) {
    const result = schema.safeParse(undefined);
    if (!result.success) {
      throw new ApiError(204, "SCHEMA_MISMATCH", "Response schema mismatch", result.error.issues);
    }
    return result.data;
  }

  const json: unknown = isJson ? await response.json() : undefined;
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError(200, "SCHEMA_MISMATCH", "Response schema mismatch", result.error.issues);
  }
  return result.data;
}
