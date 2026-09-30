import "server-only";

import { form, pause, platformJson, type SocialFetch } from "../api-client";
import { SocialError } from "../errors";
import { openSocialMediaStream } from "../media";
import { socialMediaKind, tiktokChunkPlan } from "../platforms";
import type { PublishContext, PublishResult, SocialConnection } from "./types";

// TikTok Content Posting API. Access tokens live 24 hours and are refreshed with the
// refresh token (valid a year). Until TikTok has audited the app, posts can only be
// published privately (SELF_ONLY); creator_info tells us what is allowed.

const API = "https://open.tiktokapis.com/v2";
const SCOPES = ["user.info.basic", "video.publish", "video.upload"];

type TokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
};

function tokenRequest(values: Record<string, string>, fetchImpl?: SocialFetch) {
  return platformJson<TokenResponse>("TikTok", `${API}/oauth/token/`, {
    method: "POST",
    ...form({ client_key: process.env.TIKTOK_CLIENT_KEY!.trim(), client_secret: process.env.TIKTOK_CLIENT_SECRET!.trim(), ...values }),
  }, fetchImpl);
}

export const tiktokConnection: SocialConnection = {
  key: "tiktok",
  label: "TikTok",
  platforms: ["TIKTOK"],
  requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!.trim(),
      scope: SCOPES.join(","),
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },
  async exchange(code, redirectUri, fetchImpl) {
    const token = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri }, fetchImpl);
    const info = await platformJson<{ data?: { user?: { open_id: string; display_name?: string; avatar_url?: string } } }>(
      "TikTok",
      `${API}/user/info/?fields=open_id,display_name,avatar_url`,
      { headers: { authorization: `Bearer ${token.access_token}` } },
      fetchImpl,
    );
    const user = info.data?.user;
    return [{
      platform: "TIKTOK",
      externalId: token.open_id,
      displayName: user?.display_name || "TikTok-account",
      avatarUrl: user?.avatar_url ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    }];
  },
  async refresh(refreshToken, fetchImpl) {
    const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
    return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: new Date(Date.now() + token.expires_in * 1000) };
  },
};

type TikTokEnvelope<T> = { data: T; error?: { code?: string; message?: string } };

function authorized(token: string, body: unknown): RequestInit {
  return { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) };
}

async function readRange(storageKey: string, start: number, end: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const part of openSocialMediaStream(storageKey, { start, end })) parts.push(part as Buffer);
  return Buffer.concat(parts);
}

export async function publishToTikTok(context: PublishContext): Promise<PublishResult> {
  const video = context.media.find((item) => socialMediaKind(item.contentType) === "video");
  if (!video) throw new SocialError("TIKTOK_NEEDS_VIDEO", "TikTok heeft een video nodig.", 422);
  const token = context.account.accessToken;
  const fetchImpl = context.fetchImpl;

  const creator = await platformJson<TikTokEnvelope<{ privacy_level_options?: string[]; max_video_post_duration_sec?: number }>>(
    "TikTok", `${API}/post/publish/creator_info/query/`, authorized(token, {}), fetchImpl,
  );
  const allowed = creator.data.privacy_level_options ?? [];
  const privacy = allowed.includes(context.tiktokPrivacy) ? context.tiktokPrivacy : allowed.includes("SELF_ONLY") ? "SELF_ONLY" : allowed[0];
  if (!privacy) throw new SocialError("TIKTOK_PRIVACY", "TikTok gaf geen toegestane zichtbaarheid terug.", 502);

  const plan = tiktokChunkPlan(video.sizeBytes);
  const init = await platformJson<TikTokEnvelope<{ publish_id: string; upload_url: string }>>("TikTok", `${API}/post/publish/video/init/`, authorized(token, {
    post_info: { title: context.caption.slice(0, 2_200), privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
    source_info: { source: "FILE_UPLOAD", video_size: video.sizeBytes, chunk_size: plan.chunkSize, total_chunk_count: plan.count },
  }), fetchImpl);

  for (let index = 0; index < plan.count; index += 1) {
    const start = index * plan.chunkSize;
    const end = index === plan.count - 1 ? video.sizeBytes - 1 : start + plan.chunkSize - 1;
    const bytes = await readRange(video.storageKey, start, end);
    const response = await (fetchImpl ?? fetch)(init.data.upload_url, {
      method: "PUT",
      headers: { "content-type": video.contentType, "content-length": String(bytes.length), "content-range": `bytes ${start}-${end}/${video.sizeBytes}` },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new SocialError("TIKTOK_UPLOAD", `TikTok weigerde de video-upload (${response.status}).`, 502, response.status >= 500);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await platformJson<TikTokEnvelope<{ status: string; fail_reason?: string; publicaly_available_post_id?: Array<string | number> }>>(
      "TikTok", `${API}/post/publish/status/fetch/`, authorized(token, { publish_id: init.data.publish_id }), fetchImpl,
    );
    if (status.data.status === "PUBLISH_COMPLETE") {
      const postId = status.data.publicaly_available_post_id?.[0];
      const username = context.account.username;
      return {
        externalId: postId ? String(postId) : init.data.publish_id,
        permalink: postId && username ? `https://www.tiktok.com/@${username}/video/${postId}` : null,
      };
    }
    if (status.data.status === "FAILED") throw new SocialError("TIKTOK_FAILED", `TikTok kon de video niet plaatsen: ${status.data.fail_reason ?? "onbekende reden"}.`, 502);
    await pause(5_000);
  }
  throw new SocialError("TIKTOK_TIMEOUT", "TikTok was na 5 minuten nog bezig. Controleer de TikTok-app.", 504, true);
}
