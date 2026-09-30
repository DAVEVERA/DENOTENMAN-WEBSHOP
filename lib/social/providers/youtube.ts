import "server-only";

import { form, platformJson } from "../api-client";
import { SocialError } from "../errors";
import { openSocialMediaStream } from "../media";
import { socialMediaKind } from "../platforms";
import type { PublishContext, PublishResult, SocialConnection } from "./types";

// YouTube Data API v3 with a Google OAuth client of its own (YOUTUBE_CLIENT_ID).
// Until Google has verified the app, uploads stay private; the channel owner can publish them.

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

type GoogleToken = { access_token: string; expires_in: number; refresh_token?: string };

function tokenRequest(values: Record<string, string>, fetchImpl?: typeof fetch) {
  return platformJson<GoogleToken>("YouTube", "https://oauth2.googleapis.com/token", {
    method: "POST",
    ...form({ client_id: process.env.YOUTUBE_CLIENT_ID!.trim(), client_secret: process.env.YOUTUBE_CLIENT_SECRET!.trim(), ...values }),
  }, fetchImpl);
}

export const youtubeConnection: SocialConnection = {
  key: "youtube",
  label: "YouTube",
  platforms: ["YOUTUBE"],
  requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!.trim(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  async exchange(code, redirectUri, fetchImpl) {
    const token = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri }, fetchImpl);
    if (!token.refresh_token) throw new SocialError("NO_REFRESH_TOKEN", "Google gaf geen blijvende toegang terug. Verbind YouTube opnieuw en geef toestemming.", 422);
    const channels = await platformJson<{ items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }> }>(
      "YouTube", "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { authorization: `Bearer ${token.access_token}` } }, fetchImpl,
    );
    const channel = channels.items?.[0];
    if (!channel) throw new SocialError("NO_CHANNEL", "Dit Google-account heeft geen YouTube-kanaal.", 422);
    return [{
      platform: "YOUTUBE",
      externalId: channel.id,
      displayName: channel.snippet?.title || "YouTube-kanaal",
      username: channel.snippet?.customUrl ?? null,
      avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    }];
  },
  async refresh(refreshToken, fetchImpl) {
    const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
    return { accessToken: token.access_token, refreshToken: token.refresh_token ?? refreshToken, expiresAt: new Date(Date.now() + token.expires_in * 1000) };
  },
};

export async function publishToYouTube(context: PublishContext): Promise<PublishResult> {
  const video = context.media.find((item) => socialMediaKind(item.contentType) === "video");
  if (!video) throw new SocialError("YOUTUBE_NEEDS_VIDEO", "YouTube heeft een video nodig.", 422);
  const fetchImpl = context.fetchImpl ?? fetch;
  const token = context.account.accessToken;

  const start = await fetchImpl("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": video.contentType,
      "x-upload-content-length": String(video.sizeBytes),
    },
    body: JSON.stringify({
      snippet: { title: context.youtubeTitle, description: context.caption, categoryId: "26" },
      status: { privacyStatus: context.youtubePrivacy, selfDeclaredMadeForKids: false },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const location = start.headers.get("location");
  if (!start.ok || !location) {
    if (start.status === 401) throw new SocialError("TOKEN_REJECTED", "YouTube weigert de koppeling. Verbind het account opnieuw.", 502);
    throw new SocialError("YOUTUBE_REJECTED", `YouTube weigerde de upload (${start.status}).`, 502, start.status === 429 || start.status >= 500);
  }

  // Stream the video from storage straight into YouTube's upload session.
  const stream = openSocialMediaStream(video.storageKey);
  const upload = await fetchImpl(location, {
    method: "PUT",
    headers: { "content-type": video.contentType, "content-length": String(video.sizeBytes) },
    body: stream as unknown as BodyInit,
    duplex: "half",
    signal: AbortSignal.timeout(30 * 60_000),
  } as RequestInit);
  const body = await upload.json().catch(() => null) as { id?: string } | null;
  if (!upload.ok || !body?.id) throw new SocialError("YOUTUBE_UPLOAD", `YouTube kon de video niet opslaan (${upload.status}).`, 502, upload.status >= 500);
  return { externalId: body.id, permalink: `https://www.youtube.com/watch?v=${body.id}` };
}
