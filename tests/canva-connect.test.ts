import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  buildAuthorizeUrl,
  CanvaApi,
  CanvaError,
  createPkcePair,
  editUrlWithReturn,
  exchangeAuthorizationCode,
  mapDesign,
  refreshCanvaTokens,
  waitForCanvaJob,
} from "../lib/canva/api";
import { canvaConfig, CANVA_SCOPES } from "../lib/canva/config";
import { decodeCorrelation, encodeCorrelation, safeAdminPath, verifyCanvaReturnToken } from "../lib/canva/return-token";
import { isOwnImageUrl } from "../lib/canva/sources";

const config = { clientId: "OC-test", clientSecret: "secret", redirectUri: "https://denotenman.com/api/admin/canva/callback" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("configuration needs a client ID and secret and derives the callback from SITE_URL", () => {
  assert.equal(canvaConfig({}), null);
  assert.equal(canvaConfig({ CANVA_CLIENT_ID: "OC-1" }), null);
  assert.deepEqual(canvaConfig({ CANVA_CLIENT_ID: "OC-1", CANVA_CLIENT_SECRET: "s", SITE_URL: "https://denotenman.com/" }), {
    clientId: "OC-1",
    clientSecret: "s",
    redirectUri: "https://denotenman.com/api/admin/canva/callback",
  });
});

test("the authorize URL uses PKCE S256, our scopes and the registered callback", () => {
  const { verifier, challenge } = createPkcePair();
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  const url = new URL(buildAuthorizeUrl(config, "state-1", challenge));
  assert.equal(url.origin + url.pathname, "https://www.canva.com/api/oauth/authorize");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("scope"), CANVA_SCOPES.join(" "));
  assert.equal(url.searchParams.get("client_id"), "OC-test");
  assert.equal(url.searchParams.get("state"), "state-1");
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
});

test("code exchange sends basic auth and the verifier, and keeps the expiry", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const tokens = await exchangeAuthorizationCode(config, "code-1", "verifier-1", async (url, init) => {
    seen = { url: String(url), init: init ?? {} };
    return json({ access_token: "a1", refresh_token: "r1", expires_in: 14400, scope: "design:meta:read" });
  }, 1_000);
  assert.ok(seen);
  const request = seen as { url: string; init: RequestInit };
  assert.equal(request.url, "https://api.canva.com/rest/v1/oauth/token");
  assert.equal((request.init.headers as Record<string, string>).authorization, `Basic ${Buffer.from("OC-test:secret").toString("base64")}`);
  const body = new URLSearchParams(String(request.init.body));
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code_verifier"), "verifier-1");
  assert.deepEqual(tokens, { accessToken: "a1", refreshToken: "r1", expiresAt: 1_000 + 14_400_000, scope: "design:meta:read" });
});

test("a rejected refresh asks to reconnect instead of leaking provider details", async () => {
  await assert.rejects(
    refreshCanvaTokens(config, "old", async () => json({ error: "invalid_grant", error_description: "internal" }, 400)),
    (error: unknown) => error instanceof CanvaError && error.code === "CANVA_RECONNECT" && error.status === 401 && !error.message.includes("internal"),
  );
});

test("the API client retries once with a fresh token after a 401", async () => {
  const forced: boolean[] = [];
  const authHeaders: string[] = [];
  let calls = 0;
  const api = new CanvaApi(async ({ force }) => { forced.push(force); return force ? "fresh" : "stale"; }, async (_url, init) => {
    calls += 1;
    authHeaders.push((init?.headers as Record<string, string>).authorization);
    return calls === 1 ? json({}, 401) : json({ items: [{ id: "D1", title: "Najaar", thumbnail: { url: "https://x/t.png" }, urls: { edit_url: "https://www.canva.com/d/e", view_url: "https://www.canva.com/d/v" }, updated_at: 10 }], continuation: "next" });
  });
  const result = await api.listDesigns({ query: "najaar" });
  assert.deepEqual(forced, [false, true]);
  assert.deepEqual(authHeaders, ["Bearer stale", "Bearer fresh"]);
  assert.equal(result.continuation, "next");
  assert.deepEqual(result.designs[0], { id: "D1", title: "Najaar", thumbnailUrl: "https://x/t.png", editUrl: "https://www.canva.com/d/e", viewUrl: "https://www.canva.com/d/v", pageCount: null, updatedAt: 10_000 });
});

test("Canva errors map to Dutch messages with a sensible status", async () => {
  const api = new CanvaApi(async () => "t", async () => json({ code: "x", message: "nope" }, 403));
  await assert.rejects(api.getDesign("D1"), (error: unknown) => error instanceof CanvaError && error.status === 403 && /rechten/u.test(error.message));
  assert.equal(mapDesign({ title: "zonder id" }), null);
});

test("asset uploads send the name in the metadata header as base64", async () => {
  let headers: Record<string, string> = {};
  const api = new CanvaApi(async () => "t", async (_url, init) => {
    headers = init?.headers as Record<string, string>;
    return json({ job: { id: "J1", status: "in_progress" } });
  });
  const job = await api.startAssetUpload("Cashew", Buffer.from("png"));
  assert.equal(job.status, "in_progress");
  assert.equal(headers["content-type"], "application/octet-stream");
  assert.deepEqual(JSON.parse(headers["asset-upload-metadata"]), { name_base64: Buffer.from("Cashew").toString("base64") });
});

test("jobs are polled until done, and failures or timeouts become clear errors", async () => {
  const sleep = async () => undefined;
  let polls = 0;
  const urls = await waitForCanvaJob({ id: "E1", status: "in_progress", result: null, error: null }, async () => {
    polls += 1;
    return polls < 2 ? { id: "E1", status: "in_progress", result: null, error: null } : { id: "E1", status: "success", result: ["https://export/1.png"], error: null };
  }, { sleep });
  assert.deepEqual(urls, ["https://export/1.png"]);
  await assert.rejects(
    waitForCanvaJob({ id: "E2", status: "failed", result: null, error: "license_required" }, async () => { throw new Error("not polled"); }, { sleep }),
    (error: unknown) => error instanceof CanvaError && error.code === "CANVA_JOB_FAILED" && /license_required/u.test(error.message),
  );
  await assert.rejects(
    waitForCanvaJob({ id: "E3", status: "in_progress", result: null, error: null }, async () => ({ id: "E3", status: "in_progress", result: null, error: null }), { sleep: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }, timeoutMs: 1 }),
    (error: unknown) => error instanceof CanvaError && error.code === "CANVA_TIMEOUT",
  );
});

test("return state round-trips and only admin paths are accepted", () => {
  const encoded = encodeCorrelation({ returnTo: "/admin/marketing/nieuwsbrieven/abc", pickerId: "img-1" });
  assert.deepEqual(decodeCorrelation(encoded), { returnTo: "/admin/marketing/nieuwsbrieven/abc", pickerId: "img-1" });
  assert.equal(safeAdminPath("https://evil.example/admin"), "/admin");
  assert.equal(safeAdminPath("//evil.example/admin"), "/admin");
  assert.equal(safeAdminPath("/admin//evil"), "/admin");
  assert.equal(safeAdminPath("/shop"), "/admin");
  assert.deepEqual(decodeCorrelation("not-json"), { returnTo: "/admin", pickerId: null });
  const url = new URL(editUrlWithReturn("https://www.canva.com/api/design/x/edit?token=1", encoded));
  assert.equal(url.searchParams.get("token"), "1");
  assert.equal(url.searchParams.get("correlation_state"), encoded);
});

test("the return token is accepted only when signed by Canva for our client", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };
  const make = (payload: Record<string, unknown>, key = privateKey) => {
    const head = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url")}`;
  };
  const now = 1_700_000_000_000;
  const valid = make({ aud: "OC-test", exp: now / 1000 + 60, design_id: "D9", correlation_state: "abc" });
  assert.deepEqual(await verifyCanvaReturnToken(valid, "OC-test", { keys: [jwk], now }), { designId: "D9", correlationState: "abc" });
  assert.equal(await verifyCanvaReturnToken(valid, "OC-other", { keys: [jwk], now }), null, "wrong audience");
  assert.equal(await verifyCanvaReturnToken(make({ aud: "OC-test", exp: now / 1000 - 1, design_id: "D9" }), "OC-test", { keys: [jwk], now }), null, "expired");
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal(await verifyCanvaReturnToken(make({ aud: "OC-test", design_id: "D9" }, other), "OC-test", { keys: [jwk], now }), null, "forged signature");
  assert.equal(await verifyCanvaReturnToken("a.b", "OC-test", { keys: [jwk], now }), null);
});

test("only our own bucket or site may be sent to Canva", () => {
  const environment = { CDN_BASE_URL: "https://storage.googleapis.com/notenbucket", SITE_URL: "https://denotenman.com" };
  assert.equal(isOwnImageUrl("https://storage.googleapis.com/notenbucket/media-library/a.png", environment), true);
  assert.equal(isOwnImageUrl("https://denotenman.com/brand/x.png", environment), true);
  assert.equal(isOwnImageUrl("https://storage.googleapis.com/otherbucket/a.png", environment), false);
  assert.equal(isOwnImageUrl("https://storage.googleapis.com/notenbucket-evil/a.png", environment), false);
  assert.equal(isOwnImageUrl("http://denotenman.com/x.png", environment), false);
  assert.equal(isOwnImageUrl("https://169.254.169.254/latest", environment), false);
});
