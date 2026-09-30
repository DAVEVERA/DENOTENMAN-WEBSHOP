import "server-only";

import { form, pause, platformJson, type SocialFetch } from "../api-client";
import { SocialError } from "../errors";
import { jpegUrlFor } from "../media";
import { socialMediaKind } from "../platforms";
import { publicStorageUrl } from "@/lib/storage";
import type { ConnectedAccountInput, PublishContext, PublishResult, SocialConnection } from "./types";

// Facebook pages and Instagram professional accounts, both through one Meta login.
// Page tokens derived from a long-lived user token do not expire.

function version() {
  return process.env.META_GRAPH_VERSION?.trim() || "v23.0";
}
function graph(path: string) {
  return `https://graph.facebook.com/${version()}${path}`;
}

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
];

type PagesResponse = {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
    picture?: { data?: { url?: string } };
    instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
  }>;
};

export const metaConnection: SocialConnection = {
  key: "meta",
  label: "Facebook en Instagram",
  platforms: ["FACEBOOK", "INSTAGRAM"],
  requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!.trim(),
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: SCOPES.join(","),
    });
    return `https://www.facebook.com/${version()}/dialog/oauth?${params}`;
  },
  async exchange(code, redirectUri, fetchImpl) {
    const appId = process.env.META_APP_ID!.trim();
    const appSecret = process.env.META_APP_SECRET!.trim();
    const short = await platformJson<{ access_token: string }>("Meta", graph(`/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })}`), {}, fetchImpl);
    const long = await platformJson<{ access_token: string }>("Meta", graph(`/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: short.access_token })}`), {}, fetchImpl);
    const pages = await platformJson<PagesResponse>("Meta", graph(`/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
      limit: "100",
      access_token: long.access_token,
    })}`), {}, fetchImpl);
    const accounts: ConnectedAccountInput[] = [];
    for (const page of pages.data ?? []) {
      accounts.push({ platform: "FACEBOOK", externalId: page.id, displayName: page.name, avatarUrl: page.picture?.data?.url ?? null, accessToken: page.access_token });
      const instagram = page.instagram_business_account;
      if (instagram) {
        accounts.push({
          platform: "INSTAGRAM",
          externalId: instagram.id,
          displayName: instagram.username ? `@${instagram.username}` : page.name,
          username: instagram.username ?? null,
          avatarUrl: instagram.profile_picture_url ?? null,
          accessToken: page.access_token,
          parentExternalId: page.id,
        });
      }
    }
    if (!accounts.length) throw new SocialError("NO_PAGES", "Er is geen Facebook-pagina gevonden. Kies bij het inloggen de pagina van De Notenman.", 422);
    return accounts;
  },
};

async function facebookPermalink(id: string, token: string, fetchImpl?: SocialFetch): Promise<string | null> {
  const body = await platformJson<{ permalink_url?: string }>("Facebook", graph(`/${id}?${new URLSearchParams({ fields: "permalink_url", access_token: token })}`), {}, fetchImpl).catch(() => null);
  return body?.permalink_url ?? null;
}

export async function publishToFacebook(context: PublishContext): Promise<PublishResult> {
  const { account, fetchImpl } = context;
  const page = account.externalId;
  const token = account.accessToken;
  const images = context.media.filter((item) => socialMediaKind(item.contentType) === "image");
  const video = context.media.find((item) => socialMediaKind(item.contentType) === "video");

  if (video) {
    const result = await platformJson<{ id: string }>("Facebook", graph(`/${page}/videos`), {
      method: "POST",
      ...form({ file_url: publicStorageUrl(video.storageKey), description: context.caption, access_token: token }),
      timeoutMs: 120_000,
    }, fetchImpl);
    return { externalId: result.id, permalink: `https://www.facebook.com/${page}/videos/${result.id}` };
  }

  if (images.length === 1) {
    const result = await platformJson<{ id: string; post_id?: string }>("Facebook", graph(`/${page}/photos`), {
      method: "POST",
      ...form({ url: publicStorageUrl(images[0].storageKey), caption: context.caption, access_token: token }),
    }, fetchImpl);
    const id = result.post_id ?? result.id;
    return { externalId: id, permalink: await facebookPermalink(id, token, fetchImpl) };
  }

  const fields: Record<string, string> = { message: context.caption, access_token: token };
  if (context.linkUrl) fields.link = context.linkUrl;
  if (images.length > 1) {
    // Upload the photos unpublished first, then attach them to one post.
    for (const [index, image] of images.entries()) {
      const photo = await platformJson<{ id: string }>("Facebook", graph(`/${page}/photos`), {
        method: "POST",
        ...form({ url: publicStorageUrl(image.storageKey), published: "false", access_token: token }),
      }, fetchImpl);
      fields[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photo.id });
    }
  }
  const post = await platformJson<{ id: string }>("Facebook", graph(`/${page}/feed`), { method: "POST", ...form(fields) }, fetchImpl);
  return { externalId: post.id, permalink: await facebookPermalink(post.id, token, fetchImpl) };
}

async function waitForInstagramContainer(id: string, token: string, fetchImpl?: SocialFetch) {
  // Videos are processed by Instagram before they can be published; photos are ready at once.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await platformJson<{ status_code?: string }>("Instagram", graph(`/${id}?${new URLSearchParams({ fields: "status_code", access_token: token })}`), {}, fetchImpl);
    if (!status.status_code || status.status_code === "FINISHED" || status.status_code === "PUBLISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new SocialError("INSTAGRAM_PROCESSING", "Instagram kon de video niet verwerken. Controleer formaat en lengte.", 502);
    }
    await pause(5_000);
  }
  throw new SocialError("INSTAGRAM_TIMEOUT", "Instagram was na 5 minuten nog bezig met de video. Probeer het later opnieuw.", 504, true);
}

export async function publishToInstagram(context: PublishContext): Promise<PublishResult> {
  const { account, fetchImpl } = context;
  const user = account.externalId;
  const token = account.accessToken;
  const video = context.media.find((item) => socialMediaKind(item.contentType) === "video");
  const images = context.media.filter((item) => socialMediaKind(item.contentType) === "image");
  const create = (fields: Record<string, string>) => platformJson<{ id: string }>("Instagram", graph(`/${user}/media`), {
    method: "POST",
    ...form({ ...fields, access_token: token }),
  }, fetchImpl);

  let containerId: string;
  if (video) {
    containerId = (await create({ media_type: "REELS", video_url: publicStorageUrl(video.storageKey), caption: context.caption, share_to_feed: "true" })).id;
  } else if (images.length === 1) {
    containerId = (await create({ image_url: await jpegUrlFor(images[0]), caption: context.caption })).id;
  } else {
    const children: string[] = [];
    for (const image of images) children.push((await create({ image_url: await jpegUrlFor(image), is_carousel_item: "true" })).id);
    containerId = (await create({ media_type: "CAROUSEL", children: children.join(","), caption: context.caption })).id;
  }
  await waitForInstagramContainer(containerId, token, fetchImpl);
  const published = await platformJson<{ id: string }>("Instagram", graph(`/${user}/media_publish`), {
    method: "POST",
    ...form({ creation_id: containerId, access_token: token }),
  }, fetchImpl);
  const permalink = await platformJson<{ permalink?: string }>("Instagram", graph(`/${published.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`), {}, fetchImpl).catch(() => null);
  return { externalId: published.id, permalink: permalink?.permalink ?? null };
}
