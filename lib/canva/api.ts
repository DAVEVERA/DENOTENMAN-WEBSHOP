import { createHash, randomBytes } from "node:crypto";

import { CANVA_API_BASE, CANVA_AUTH_BASE, CANVA_SCOPES, type CanvaConfig } from "./config";

// Thin, dependency-free client for the Canva Connect REST API. Network access goes
// through an injectable fetch so the behaviour can be tested without Canva.

export class CanvaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CanvaError";
  }
}

export type CanvaTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scope: string;
};

type FetchLike = typeof fetch;

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function buildAuthorizeUrl(config: CanvaConfig, state: string, codeChallenge: string): string {
  const url = new URL(`${CANVA_AUTH_BASE}/oauth/authorize`);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", CANVA_SCOPES.join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUri);
  return url.toString();
}

function basicAuth(config: CanvaConfig): string {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

async function tokenRequest(config: CanvaConfig, body: Record<string, string>, fetchImpl: FetchLike, now: number): Promise<CanvaTokens> {
  let response: Response;
  try {
    response = await fetchImpl(`${CANVA_API_BASE}/v1/oauth/token`, {
      method: "POST",
      headers: { authorization: basicAuth(config), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new CanvaError("CANVA_UNREACHABLE", "Canva is niet bereikbaar. Probeer het later opnieuw.", 502);
  }
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || typeof data?.access_token !== "string" || typeof data.refresh_token !== "string") {
    const code = typeof data?.error === "string" ? data.error : `HTTP_${response.status}`;
    throw new CanvaError(
      code === "invalid_grant" ? "CANVA_RECONNECT" : "CANVA_TOKEN_FAILED",
      code === "invalid_grant" ? "De Canva-koppeling is verlopen. Koppel Canva opnieuw." : "Canva gaf geen toegang. Koppel Canva opnieuw.",
      response.status === 400 || response.status === 401 ? 401 : 502,
    );
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 4 * 60 * 60;
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: now + expiresIn * 1000, scope: typeof data.scope === "string" ? data.scope : "" };
}

export function exchangeAuthorizationCode(config: CanvaConfig, code: string, verifier: string, fetchImpl: FetchLike = fetch, now = Date.now()) {
  return tokenRequest(config, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUri }, fetchImpl, now);
}

/** Canva refresh tokens are single use: always store the new pair. */
export function refreshCanvaTokens(config: CanvaConfig, refreshToken: string, fetchImpl: FetchLike = fetch, now = Date.now()) {
  return tokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl, now);
}

export async function revokeCanvaToken(config: CanvaConfig, token: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await fetchImpl(`${CANVA_API_BASE}/v1/oauth/revoke`, {
    method: "POST",
    headers: { authorization: basicAuth(config), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

export type CanvaDesign = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  editUrl: string | null;
  viewUrl: string | null;
  pageCount: number | null;
  updatedAt: number | null;
};

export type CanvaJob<T> = { id: string; status: "in_progress" | "success" | "failed"; result: T | null; error: string | null };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function mapDesign(value: unknown): CanvaDesign | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const urls = isRecord(value.urls) ? value.urls : {};
  const thumbnail = isRecord(value.thumbnail) ? value.thumbnail : {};
  return {
    id: value.id,
    title: str(value.title) ?? "Naamloos design",
    thumbnailUrl: str(thumbnail.url),
    editUrl: str(urls.edit_url),
    viewUrl: str(urls.view_url),
    pageCount: typeof value.page_count === "number" ? value.page_count : null,
    updatedAt: typeof value.updated_at === "number" ? value.updated_at * 1000 : null,
  };
}

function mapJob<T>(value: unknown, result: (job: UnknownRecord) => T | null): CanvaJob<T> {
  const job = isRecord(value) && isRecord(value.job) ? value.job : null;
  if (!job || typeof job.id !== "string") throw new CanvaError("CANVA_BAD_RESPONSE", "Canva gaf een onverwacht antwoord.", 502);
  const status = job.status === "success" || job.status === "failed" ? job.status : "in_progress";
  const error = isRecord(job.error) ? str(job.error.message) ?? str(job.error.code) : null;
  return { id: job.id, status, result: status === "success" ? result(job) : null, error };
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "De Canva-koppeling is verlopen. Koppel Canva opnieuw.",
  403: "Canva weigert deze actie. Controleer de rechten (scopes) van de integratie.",
  404: "Dit design bestaat niet (meer) of is niet met dit account gedeeld.",
  429: "Canva krijgt te veel verzoeken. Wacht een minuut en probeer opnieuw.",
};

/** Calls Canva with a bearer token; a 401 refreshes the token once and retries. */
export class CanvaApi {
  constructor(
    private readonly accessToken: (options: { force: boolean }) => Promise<string>,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request(method: string, path: string, init: { json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}, retried = false): Promise<unknown> {
    const token = await this.accessToken({ force: retried });
    let response: Response;
    try {
      response = await this.fetchImpl(`${CANVA_API_BASE}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.json !== undefined ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
        body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new CanvaError("CANVA_UNREACHABLE", "Canva is niet bereikbaar. Probeer het later opnieuw.", 502);
    }
    if (response.status === 401 && !retried) return this.request(method, path, init, true);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = isRecord(data) ? str(data.message) : null;
      throw new CanvaError(
        response.status === 401 ? "CANVA_RECONNECT" : `CANVA_HTTP_${response.status}`,
        STATUS_MESSAGES[response.status] ?? (detail ? `Canva: ${detail}` : "Canva kon dit niet uitvoeren."),
        response.status === 401 ? 401 : response.status >= 500 ? 502 : response.status,
      );
    }
    return data;
  }

  async profile(): Promise<{ userId: string | null; teamId: string | null; displayName: string | null }> {
    const [me, profile] = await Promise.all([
      this.request("GET", "/v1/users/me").catch(() => null),
      this.request("GET", "/v1/users/me/profile").catch(() => null),
    ]);
    const teamUser = isRecord(me) && isRecord(me.team_user) ? me.team_user : {};
    const details = isRecord(profile) && isRecord(profile.profile) ? profile.profile : {};
    return { userId: str(teamUser.user_id), teamId: str(teamUser.team_id), displayName: str(details.display_name) };
  }

  async listDesigns(options: { query?: string; continuation?: string } = {}): Promise<{ designs: CanvaDesign[]; continuation: string | null }> {
    const params = new URLSearchParams({ ownership: "any", sort_by: "modified_descending" });
    if (options.query?.trim()) params.set("query", options.query.trim().slice(0, 255));
    if (options.continuation) params.set("continuation", options.continuation);
    const data = await this.request("GET", `/v1/designs?${params}`);
    const items = isRecord(data) && Array.isArray(data.items) ? data.items : [];
    return {
      designs: items.map(mapDesign).filter((design): design is CanvaDesign => design !== null),
      continuation: isRecord(data) ? str(data.continuation) : null,
    };
  }

  async getDesign(designId: string): Promise<CanvaDesign> {
    const data = await this.request("GET", `/v1/designs/${encodeURIComponent(designId)}`);
    const design = mapDesign(isRecord(data) ? data.design : null);
    if (!design) throw new CanvaError("CANVA_BAD_RESPONSE", "Canva gaf een onverwacht antwoord.", 502);
    return design;
  }

  async createDesign(input: { title: string; width: number; height: number; assetId?: string }): Promise<CanvaDesign> {
    const data = await this.request("POST", "/v1/designs", {
      json: {
        design_type: { type: "custom", width: input.width, height: input.height },
        title: input.title.slice(0, 255),
        ...(input.assetId ? { asset_id: input.assetId } : {}),
      },
    });
    const design = mapDesign(isRecord(data) ? data.design : null);
    if (!design?.editUrl) throw new CanvaError("CANVA_BAD_RESPONSE", "Canva gaf geen bewerklink terug.", 502);
    return design;
  }

  async startExport(designId: string, format: "png" | "jpg", pages?: number[]): Promise<CanvaJob<string[]>> {
    const data = await this.request("POST", "/v1/exports", {
      json: {
        design_id: designId,
        format: format === "jpg" ? { type: "jpg", quality: 90, ...(pages ? { pages } : {}) } : { type: "png", ...(pages ? { pages } : {}) },
      },
    });
    return mapJob(data, exportUrls);
  }

  async getExport(exportId: string): Promise<CanvaJob<string[]>> {
    return mapJob(await this.request("GET", `/v1/exports/${encodeURIComponent(exportId)}`), exportUrls);
  }

  async startAssetUpload(name: string, bytes: Buffer): Promise<CanvaJob<string>> {
    const data = await this.request("POST", "/v1/asset-uploads", {
      body: new Uint8Array(bytes),
      headers: {
        "content-type": "application/octet-stream",
        "asset-upload-metadata": JSON.stringify({ name_base64: Buffer.from(name.slice(0, 50)).toString("base64") }),
      },
    });
    return mapJob(data, assetId);
  }

  async getAssetUpload(jobId: string): Promise<CanvaJob<string>> {
    return mapJob(await this.request("GET", `/v1/asset-uploads/${encodeURIComponent(jobId)}`), assetId);
  }
}

function exportUrls(job: UnknownRecord): string[] | null {
  const urls = Array.isArray(job.urls) ? job.urls.filter((url): url is string => typeof url === "string" && url.startsWith("https://")) : [];
  return urls.length ? urls : null;
}

function assetId(job: UnknownRecord): string | null {
  return isRecord(job.asset) ? str(job.asset.id) : null;
}

/** Polls a Canva job until it succeeds, fails or the time is up. */
export async function waitForCanvaJob<T>(
  first: CanvaJob<T>,
  poll: (id: string) => Promise<CanvaJob<T>>,
  options: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const timeout = options.timeoutMs ?? 60_000;
  const interval = options.intervalMs ?? 1_500;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let job = first;
  const started = Date.now();
  while (job.status === "in_progress") {
    if (Date.now() - started > timeout) throw new CanvaError("CANVA_TIMEOUT", "Canva is nog bezig. Probeer het over een minuut opnieuw.", 504);
    await sleep(interval);
    job = await poll(job.id);
  }
  if (job.status === "failed" || job.result === null) {
    throw new CanvaError("CANVA_JOB_FAILED", job.error ? `Canva: ${job.error}` : "Canva kon dit niet afronden.", 502);
  }
  return job.result;
}

/** Adds the state Canva hands back on "Return to De Notenman". */
export function editUrlWithReturn(editUrl: string, correlationState: string): string {
  const url = new URL(editUrl);
  url.searchParams.set("correlation_state", correlationState);
  return url.toString();
}
