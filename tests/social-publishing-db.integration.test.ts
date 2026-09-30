import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { prisma } from "../lib/prisma";
import { openWithPurpose } from "../lib/secret-box";
import {
  createSocialPost,
  getSocialPost,
  processDueSocialPosts,
  publishSocialPostNow,
  retrySocialPost,
  saveConnectedAccounts,
  scheduleSocialPost,
  type SocialDeps,
} from "../lib/social/service";

const run = randomUUID().slice(0, 8);
const previous = { secret: process.env.ADMIN_SESSION_SECRET, cdn: process.env.CDN_BASE_URL, tiktokKey: process.env.TIKTOK_CLIENT_KEY, tiktokSecret: process.env.TIKTOK_CLIENT_SECRET };
let adminId = "";
const accountIds: Record<string, string> = {};
let imageId = "";
const postIds: string[] = [];

// Every platform call goes through this mock; each test sets the behaviour it needs.
const calls: string[] = [];
let respond: (url: string, init?: RequestInit) => Response = () => new Response("not mocked", { status: 500 });
const fetchImpl: typeof fetch = async (input, init) => {
  const url = String(input);
  calls.push(`${init?.method ?? "GET"} ${url.replace(/access_token=[^&]+/u, "access_token=…")}`);
  return respond(url, init);
};
let clock = new Date("2099-06-01T10:00:00.000Z");
const deps: SocialDeps = { now: () => clock, fetchImpl };

const basePost = (overrides: Record<string, unknown> = {}) => ({
  title: `Test ${run}`,
  caption: "Vers gebrande cashewnoten, vanaf zaterdag op de markt.",
  platformCaptions: null,
  mediaIds: [],
  linkUrl: null,
  youtubeTitle: null,
  youtubePrivacy: "public",
  tiktokPrivacy: "PUBLIC_TO_EVERYONE",
  accountIds: [] as string[],
  scheduledAt: null,
  campaignId: null,
  ...overrides,
});

before(async () => {
  process.env.ADMIN_SESSION_SECRET ||= "integration-test-admin-secret";
  process.env.CDN_BASE_URL = "https://cdn.example.test";
  process.env.TIKTOK_CLIENT_KEY = "test-client-key";
  process.env.TIKTOK_CLIENT_SECRET = "test-client-secret";
  const admin = await prisma.adminUser.create({ data: { username: `social-test-${run}`, passwordHash: "x", name: "Social test", role: "ADMIN" } });
  adminId = admin.id;
  const saved = await saveConnectedAccounts([
    { platform: "FACEBOOK", externalId: `page-${run}`, displayName: "De Notenman", accessToken: "page-token" },
    { platform: "INSTAGRAM", externalId: `ig-${run}`, displayName: "@denotenman", username: "denotenman", accessToken: "page-token", parentExternalId: `page-${run}` },
    { platform: "TIKTOK", externalId: `tt-${run}`, displayName: "De Notenman TikTok", accessToken: "old-tiktok-token", refreshToken: "tiktok-refresh", tokenExpiresAt: new Date("2099-06-01T09:00:00.000Z") },
  ], adminId);
  for (const account of saved) accountIds[account.platform] = account.id;
  const image = await prisma.socialMediaAsset.create({
    data: { storageKey: `social/test-${run}/foto.jpg`, originalFilename: "foto.jpg", contentType: "image/jpeg", sizeBytes: 1234, width: 1080, height: 1080, completedAt: new Date() },
  });
  imageId = image.id;
});

after(async () => {
  await prisma.socialPost.deleteMany({ where: { id: { in: postIds } } });
  await prisma.socialAccount.deleteMany({ where: { id: { in: Object.values(accountIds) } } });
  await prisma.socialMediaAsset.deleteMany({ where: { id: imageId } });
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
  Object.assign(process.env, { ADMIN_SESSION_SECRET: previous.secret, CDN_BASE_URL: previous.cdn, TIKTOK_CLIENT_KEY: previous.tiktokKey, TIKTOK_CLIENT_SECRET: previous.tiktokSecret });
});

test("tokens are stored encrypted", async () => {
  const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: accountIds.FACEBOOK } });
  assert.doesNotMatch(account.accessTokenEncrypted, /page-token/u);
  assert.equal(openWithPurpose(account.accessTokenEncrypted, "social-tokens-v1"), "page-token");
});

test("a post cannot be planned for a channel that cannot publish it", async () => {
  const post = await createSocialPost(basePost({ accountIds: [accountIds.INSTAGRAM] }), adminId);
  postIds.push(post.id);
  assert.match(post.problems[accountIds.INSTAGRAM].join(), /minimaal één foto/u);
  await assert.rejects(scheduleSocialPost(post.id, "2099-06-02T10:00:00.000Z", deps), (error: Error & { code?: string }) => error.code === "NOT_PUBLISHABLE");
});

test("publishing now reaches Facebook and Instagram and stores the links", async () => {
  respond = (url, init) => {
    // One photo: Facebook posts it through /photos with the caption.
    if (url.includes(`/page-${run}/photos`) && init?.method === "POST") {
      assert.match(String(init.body), /caption=Algemeen/u, "Facebook gets the general caption");
      return Response.json({ id: "photo-1", post_id: `page-${run}_111` });
    }
    if (url.includes(`/page-${run}_111?`)) return Response.json({ permalink_url: "https://www.facebook.com/denotenman/posts/111" });
    if (url.includes(`/ig-${run}/media_publish`)) return Response.json({ id: "ig-media-222" });
    if (url.includes(`/ig-${run}/media`) && init?.method === "POST") {
      assert.match(String(init.body), /image_url=https%3A%2F%2Fcdn\.example\.test%2Fsocial%2F/u);
      assert.match(String(init.body), /caption=Voor\+Instagram\+%23noten/u);
      return Response.json({ id: "container-1" });
    }
    if (url.includes("/container-1?")) return Response.json({ status_code: "FINISHED" });
    if (url.includes("/ig-media-222?")) return Response.json({ permalink: "https://www.instagram.com/p/abc/" });
    return new Response("unexpected", { status: 500 });
  };
  const post = await createSocialPost(basePost({ mediaIds: [imageId], accountIds: [accountIds.FACEBOOK, accountIds.INSTAGRAM], caption: "Algemeen", platformCaptions: { INSTAGRAM: "Voor Instagram #noten" } }), adminId);
  postIds.push(post.id);
  const published = await publishSocialPostNow(post.id, deps);
  assert.equal(published.status, "PUBLISHED");
  const links = Object.fromEntries(published.targets.map((target) => [target.platform, target.permalink]));
  assert.deepEqual(links, { FACEBOOK: "https://www.facebook.com/denotenman/posts/111", INSTAGRAM: "https://www.instagram.com/p/abc/" });
  assert.ok(calls.some((call) => call.includes(`/ig-${run}/media`) && call.startsWith("POST")), "Instagram gets its own caption");
  assert.ok(calls.some((call) => call.includes(`/ig-${run}/media_publish`)), "Instagram publishes the container");
});

test("a temporary platform error is retried by the scheduler, then given up after three attempts", async () => {
  let facebookCalls = 0;
  respond = (url, init) => {
    if (url.includes(`/page-${run}/feed`) && init?.method === "POST") {
      facebookCalls += 1;
      return Response.json({ error: { message: "Service temporarily unavailable" } }, { status: 503 });
    }
    return new Response("unexpected", { status: 500 });
  };
  const post = await createSocialPost(basePost({ accountIds: [accountIds.FACEBOOK], scheduledAt: "2099-06-01T10:30:00.000Z" }), adminId);
  postIds.push(post.id);
  assert.equal(post.status, "SCHEDULED");

  await processDueSocialPosts(deps);
  assert.equal(facebookCalls, 0, "not due yet");

  clock = new Date("2099-06-01T10:31:00.000Z");
  await processDueSocialPosts(deps);
  assert.equal((await getSocialPost(post.id)).status, "SCHEDULED", "stays planned for a retry");
  await processDueSocialPosts(deps);
  await processDueSocialPosts(deps);
  const failed = await getSocialPost(post.id);
  assert.equal(facebookCalls, 3);
  assert.equal(failed.status, "FAILED");
  assert.match(failed.targets[0].error ?? "", /Service temporarily unavailable/u);

  respond = (url, init) => {
    if (url.includes(`/page-${run}/feed`) && init?.method === "POST") return Response.json({ id: `page-${run}_333` });
    if (url.includes(`/page-${run}_333?`)) return Response.json({ permalink_url: "https://www.facebook.com/denotenman/posts/333" });
    return new Response("unexpected", { status: 500 });
  };
  const retried = await retrySocialPost(post.id, deps);
  assert.equal(retried.status, "PUBLISHED");
  assert.equal(retried.targets[0].permalink, "https://www.facebook.com/denotenman/posts/333");
});

test("an expired TikTok token is refreshed before publishing", async () => {
  const video = await prisma.socialMediaAsset.create({
    data: { storageKey: `social/test-${run}/film.mp4`, originalFilename: "film.mp4", contentType: "video/mp4", sizeBytes: 4_000_000, completedAt: new Date() },
  });
  try {
    respond = (url) => {
      if (url.includes("/oauth/token/")) return Response.json({ access_token: "new-tiktok-token", expires_in: 86_400, open_id: `tt-${run}`, refresh_token: "tiktok-refresh-2", refresh_expires_in: 31_536_000 });
      // Stop before the upload itself (which reads from Cloud Storage).
      if (url.includes("/creator_info/query/")) return Response.json({ error: { code: "spam_risk_too_many_posts", message: "Te veel berichten vandaag" } }, { status: 403 });
      return new Response("unexpected", { status: 500 });
    };
    const post = await createSocialPost(basePost({ mediaIds: [video.id], accountIds: [accountIds.TIKTOK] }), adminId);
    postIds.push(post.id);
    const result = await publishSocialPostNow(post.id, deps);
    assert.equal(result.status, "FAILED");
    assert.match(result.targets[0].error ?? "", /Te veel berichten vandaag/u);
    const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: accountIds.TIKTOK } });
    assert.equal(openWithPurpose(account.accessTokenEncrypted, "social-tokens-v1"), "new-tiktok-token");
    assert.equal(openWithPurpose(account.refreshTokenEncrypted, "social-tokens-v1"), "tiktok-refresh-2");
    assert.ok(calls.some((call) => call.includes("/oauth/token/")));
  } finally {
    await prisma.socialMediaAsset.delete({ where: { id: video.id } });
  }
});

test("a post interrupted mid-publish is marked for checking instead of being posted twice", async () => {
  const post = await createSocialPost(basePost({ accountIds: [accountIds.FACEBOOK] }), adminId);
  postIds.push(post.id);
  await prisma.socialPost.update({ where: { id: post.id }, data: { status: "PUBLISHING", scheduledAt: clock } });
  await prisma.socialPostTarget.updateMany({ where: { postId: post.id }, data: { status: "PUBLISHING" } });
  await prisma.$executeRaw`UPDATE "SocialPost" SET "updatedAt" = ${new Date(clock.getTime() - 60 * 60 * 1000)} WHERE id = ${post.id}`;
  const result = await processDueSocialPosts(deps);
  assert.equal(result.recovered >= 1, true);
  const recovered = await getSocialPost(post.id);
  assert.equal(recovered.status, "FAILED");
  assert.match(recovered.targets[0].error ?? "", /onderbroken/u);
});
