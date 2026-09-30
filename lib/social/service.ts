import "server-only";
import { Prisma, type SocialAccount, type SocialPlatform } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { openWithPurpose, sealWithPurpose } from "@/lib/secret-box";
import type { SocialFetch } from "./api-client";
import { SocialError } from "./errors";
import { loadSocialMedia, socialMediaDto, type SocialMediaDto } from "./media";
import {
  captionFor,
  platformProblems,
  SOCIAL_PLATFORMS,
  socialMediaKind,
  TIKTOK_PRIVACY,
  YOUTUBE_PRIVACY,
  youtubeTitleFor,
  type SocialPlatformName,
} from "./platforms";
import { connectionForPlatform, PUBLISHERS } from "./providers";
import type { ConnectedAccountInput } from "./providers/types";

const TOKEN_PURPOSE = "social-tokens-v1";
const MAX_ATTEMPTS = 3;
/** A post still "publishing" after this long was interrupted (for example a restart). */
const STUCK_AFTER_MS = 30 * 60 * 1000;

export type SocialDeps = { now: () => Date; fetchImpl?: SocialFetch };
const defaultDeps: SocialDeps = { now: () => new Date() };

// ---------- Accounts ----------

export type SocialAccountDto = {
  id: string;
  platform: SocialPlatformName;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  lastError: string | null;
  connectedAt: string;
};

function accountDto(account: SocialAccount): SocialAccountDto {
  return {
    id: account.id,
    platform: account.platform,
    displayName: account.displayName,
    username: account.username,
    avatarUrl: account.avatarUrl,
    status: account.status,
    lastError: account.lastError,
    connectedAt: account.connectedAt.toISOString(),
  };
}

export async function listSocialAccounts(): Promise<SocialAccountDto[]> {
  const accounts = await prisma.socialAccount.findMany({ where: { status: { not: "DISCONNECTED" } }, orderBy: [{ platform: "asc" }, { displayName: "asc" }] });
  return accounts.map(accountDto);
}

export async function saveConnectedAccounts(inputs: ConnectedAccountInput[], adminUserId: string): Promise<SocialAccountDto[]> {
  const saved: SocialAccountDto[] = [];
  for (const input of inputs) {
    const data = {
      displayName: input.displayName.slice(0, 200),
      username: input.username ?? null,
      avatarUrl: input.avatarUrl ?? null,
      accessTokenEncrypted: sealWithPurpose(input.accessToken, TOKEN_PURPOSE),
      refreshTokenEncrypted: input.refreshToken ? sealWithPurpose(input.refreshToken, TOKEN_PURPOSE) : null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      parentExternalId: input.parentExternalId ?? null,
      status: "CONNECTED",
      lastError: null,
      connectedByAdminId: adminUserId,
      connectedAt: new Date(),
    };
    const account = await prisma.socialAccount.upsert({
      where: { platform_externalId: { platform: input.platform, externalId: input.externalId } },
      update: data,
      create: { platform: input.platform, externalId: input.externalId, ...data },
    });
    saved.push(accountDto(account));
  }
  return saved;
}

/** Disconnecting keeps the publishing history; the tokens are wiped. */
export async function disconnectSocialAccount(id: string): Promise<void> {
  await prisma.socialAccount.update({
    where: { id },
    data: { status: "DISCONNECTED", accessTokenEncrypted: "", refreshTokenEncrypted: null, tokenExpiresAt: null },
  });
}

async function accessTokenFor(account: SocialAccount, deps: SocialDeps): Promise<string> {
  const token = openWithPurpose(account.accessTokenEncrypted, TOKEN_PURPOSE);
  if (!token || account.status === "DISCONNECTED") throw new SocialError("ACCOUNT_DISCONNECTED", `${account.displayName} is niet meer gekoppeld. Verbind het account opnieuw.`, 409);
  const expiresSoon = account.tokenExpiresAt && account.tokenExpiresAt.getTime() - deps.now().getTime() < 5 * 60 * 1000;
  if (!expiresSoon) return token;

  const connection = connectionForPlatform(account.platform);
  const refreshToken = openWithPurpose(account.refreshTokenEncrypted, TOKEN_PURPOSE);
  if (!connection.refresh || !refreshToken) throw new SocialError("TOKEN_EXPIRED", `De koppeling met ${account.displayName} is verlopen. Verbind het account opnieuw.`, 409);
  try {
    const fresh = await connection.refresh(refreshToken, deps.fetchImpl);
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: sealWithPurpose(fresh.accessToken, TOKEN_PURPOSE),
        refreshTokenEncrypted: fresh.refreshToken ? sealWithPurpose(fresh.refreshToken, TOKEN_PURPOSE) : account.refreshTokenEncrypted,
        tokenExpiresAt: fresh.expiresAt,
        status: "CONNECTED",
        lastError: null,
      },
    });
    return fresh.accessToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.socialAccount.update({ where: { id: account.id }, data: { status: "EXPIRED", lastError: message } });
    throw new SocialError("TOKEN_EXPIRED", `De koppeling met ${account.displayName} is verlopen. Verbind het account opnieuw.`, 409);
  }
}

// ---------- Campaigns ----------

export const socialCampaignInputSchema = z.object({
  name: z.string().trim().min(1, "Geef de campagne een naam.").max(120),
  description: z.string().trim().max(2_000).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/u, "Kies een kleur."),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
}).strict().refine((value) => !value.startsAt || !value.endsAt || value.startsAt <= value.endsAt, { message: "De einddatum ligt voor de startdatum.", path: ["endsAt"] });

export type SocialCampaignDto = { id: string; name: string; description: string | null; color: string; startsAt: string | null; endsAt: string | null; postCount: number };

export async function listSocialCampaigns(): Promise<SocialCampaignDto[]> {
  const campaigns = await prisma.socialCampaign.findMany({ orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }], include: { _count: { select: { posts: true } } } });
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    color: campaign.color,
    startsAt: campaign.startsAt?.toISOString() ?? null,
    endsAt: campaign.endsAt?.toISOString() ?? null,
    postCount: campaign._count.posts,
  }));
}

export async function saveSocialCampaign(id: string | null, candidate: unknown): Promise<SocialCampaignDto> {
  const input = socialCampaignInputSchema.parse(candidate);
  const data = { ...input, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null };
  const campaign = id
    ? await prisma.socialCampaign.update({ where: { id }, data })
    : await prisma.socialCampaign.create({ data });
  return (await listSocialCampaigns()).find((item) => item.id === campaign.id)!;
}

export async function deleteSocialCampaign(id: string): Promise<void> {
  await prisma.socialCampaign.delete({ where: { id } });
}

// ---------- Posts ----------

const platformCaptionsSchema = z.object(Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, z.string().max(63_206).optional()])) as Record<SocialPlatformName, z.ZodOptional<z.ZodString>>).strict();

export const socialPostInputSchema = z.object({
  title: z.string().trim().min(1, "Geef het bericht een werktitel.").max(160),
  caption: z.string().max(63_206),
  platformCaptions: platformCaptionsSchema.nullable(),
  mediaIds: z.array(z.string().min(1).max(40)).max(10),
  linkUrl: z.string().trim().max(1_000).refine((value) => value === "" || /^https?:\/\/\S+$/u.test(value), "Gebruik een volledige link (https://…).").nullable(),
  youtubeTitle: z.string().trim().max(100).nullable(),
  youtubePrivacy: z.enum(YOUTUBE_PRIVACY),
  tiktokPrivacy: z.enum(TIKTOK_PRIVACY),
  accountIds: z.array(z.string().min(1).max(40)).max(12),
  scheduledAt: z.string().datetime().nullable(),
  campaignId: z.string().min(1).max(40).nullable(),
}).strict();

export type SocialPostInput = z.infer<typeof socialPostInputSchema>;

export type SocialTargetDto = {
  id: string;
  accountId: string;
  platform: SocialPlatformName;
  accountName: string;
  status: string;
  permalink: string | null;
  error: string | null;
  publishedAt: string | null;
};

export type SocialPostDto = {
  id: string;
  title: string;
  caption: string;
  platformCaptions: Partial<Record<SocialPlatformName, string>>;
  media: SocialMediaDto[];
  linkUrl: string | null;
  youtubeTitle: string | null;
  youtubePrivacy: string;
  tiktokPrivacy: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  campaign: { id: string; name: string; color: string } | null;
  targets: SocialTargetDto[];
  /** Problems per target account; empty when the post can be published there. */
  problems: Record<string, string[]>;
  updatedAt: string;
};

const postInclude = {
  campaign: { select: { id: true, name: true, color: true } },
  targets: { include: { account: true }, orderBy: { account: { platform: "asc" as const } } },
} satisfies Prisma.SocialPostInclude;

type LoadedPost = Prisma.SocialPostGetPayload<{ include: typeof postInclude }>;

function captionsOf(value: Prisma.JsonValue): Partial<Record<SocialPlatformName, string>> {
  const parsed = platformCaptionsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

async function postDtos(posts: LoadedPost[]): Promise<SocialPostDto[]> {
  const media = await loadSocialMedia([...new Set(posts.flatMap((post) => post.mediaIds))]);
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  return posts.map((post) => {
    const assets = post.mediaIds.map((id) => mediaById.get(id)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    const content = {
      caption: post.caption,
      platformCaptions: captionsOf(post.platformCaptions),
      media: assets,
      linkUrl: post.linkUrl,
      youtubeTitle: post.youtubeTitle,
    };
    return {
      id: post.id,
      title: post.title,
      caption: post.caption,
      platformCaptions: content.platformCaptions,
      media: assets.map(socialMediaDto),
      linkUrl: post.linkUrl,
      youtubeTitle: post.youtubeTitle,
      youtubePrivacy: post.youtubePrivacy,
      tiktokPrivacy: post.tiktokPrivacy,
      status: post.status,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      campaign: post.campaign,
      targets: post.targets.map((target) => ({
        id: target.id,
        accountId: target.accountId,
        platform: target.account.platform,
        accountName: target.account.displayName,
        status: target.status,
        permalink: target.permalink,
        error: target.error,
        publishedAt: target.publishedAt?.toISOString() ?? null,
      })),
      problems: Object.fromEntries(post.targets.map((target) => [
        target.accountId,
        [
          ...(target.account.status !== "CONNECTED" ? [`${target.account.displayName} is niet meer gekoppeld.`] : []),
          ...platformProblems(target.account.platform, content),
        ],
      ])),
      updatedAt: post.updatedAt.toISOString(),
    };
  });
}

export async function getSocialPost(id: string): Promise<SocialPostDto> {
  const post = await prisma.socialPost.findUnique({ where: { id }, include: postInclude });
  if (!post) throw new SocialError("POST_NOT_FOUND", "Dit bericht bestaat niet.", 404);
  return (await postDtos([post]))[0];
}

/** Posts planned or published in a period, plus unplanned drafts. */
export async function listSocialPosts(range: { from: Date; to: Date }): Promise<SocialPostDto[]> {
  const posts = await prisma.socialPost.findMany({
    where: {
      OR: [
        { scheduledAt: { gte: range.from, lt: range.to } },
        { publishedAt: { gte: range.from, lt: range.to } },
        { scheduledAt: null, publishedAt: null },
      ],
    },
    include: postInclude,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  return postDtos(posts);
}

async function validateReferences(input: SocialPostInput) {
  const accounts = await prisma.socialAccount.findMany({ where: { id: { in: input.accountIds } } });
  if (accounts.length !== new Set(input.accountIds).size) throw new SocialError("ACCOUNT_UNKNOWN", "Een gekozen kanaal bestaat niet meer.", 422);
  const media = await loadSocialMedia(input.mediaIds);
  if (media.length !== input.mediaIds.length) throw new SocialError("MEDIA_UNKNOWN", "Een bestand is nog niet klaar met uploaden of bestaat niet meer.", 422);
  if (input.campaignId && !(await prisma.socialCampaign.findUnique({ where: { id: input.campaignId }, select: { id: true } }))) {
    throw new SocialError("CAMPAIGN_UNKNOWN", "Deze campagne bestaat niet meer.", 422);
  }
}

function postData(input: SocialPostInput) {
  const platformCaptions = Object.fromEntries(Object.entries(input.platformCaptions ?? {}).filter(([, value]) => value?.trim()));
  return {
    title: input.title,
    caption: input.caption,
    platformCaptions: Object.keys(platformCaptions).length ? platformCaptions : Prisma.DbNull,
    mediaIds: input.mediaIds,
    linkUrl: input.linkUrl || null,
    youtubeTitle: input.youtubeTitle || null,
    youtubePrivacy: input.youtubePrivacy,
    tiktokPrivacy: input.tiktokPrivacy,
    campaignId: input.campaignId,
  };
}

async function syncTargets(tx: Prisma.TransactionClient, postId: string, accountIds: string[]) {
  // Published targets stay as history; other targets follow the chosen channels.
  await tx.socialPostTarget.deleteMany({ where: { postId, accountId: { notIn: accountIds }, status: { not: "PUBLISHED" } } });
  const existing = await tx.socialPostTarget.findMany({ where: { postId }, select: { accountId: true } });
  const have = new Set(existing.map((target) => target.accountId));
  const missing = accountIds.filter((accountId) => !have.has(accountId));
  if (missing.length) await tx.socialPostTarget.createMany({ data: missing.map((accountId) => ({ postId, accountId })) });
}

export async function createSocialPost(candidate: unknown, adminUserId: string): Promise<SocialPostDto> {
  const input = socialPostInputSchema.parse(candidate);
  await validateReferences(input);
  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.socialPost.create({ data: { ...postData(input), status: "DRAFT", createdByAdminId: adminUserId } });
    await syncTargets(tx, created.id, input.accountIds);
    return created;
  });
  if (input.scheduledAt) return scheduleSocialPost(post.id, input.scheduledAt);
  return getSocialPost(post.id);
}

const EDITABLE: Array<"DRAFT" | "SCHEDULED" | "FAILED" | "PARTIAL"> = ["DRAFT", "SCHEDULED", "FAILED", "PARTIAL"];

export async function updateSocialPost(id: string, candidate: unknown): Promise<SocialPostDto> {
  const input = socialPostInputSchema.parse(candidate);
  await validateReferences(input);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.socialPost.updateMany({ where: { id, status: { in: EDITABLE } }, data: postData(input) });
    if (updated.count !== 1) throw new SocialError("POST_NOT_EDITABLE", "Een bericht dat wordt geplaatst of al geplaatst is, kan niet meer worden aangepast.", 409);
    await syncTargets(tx, id, input.accountIds);
  });
  const current = await prisma.socialPost.findUniqueOrThrow({ where: { id }, select: { status: true } });
  if (input.scheduledAt) return scheduleSocialPost(id, input.scheduledAt);
  if (current.status === "SCHEDULED") await prisma.socialPost.update({ where: { id }, data: { status: "DRAFT", scheduledAt: null } });
  return getSocialPost(id);
}

export async function deleteSocialPost(id: string): Promise<void> {
  const deleted = await prisma.socialPost.deleteMany({ where: { id, status: { not: "PUBLISHING" } } });
  if (deleted.count !== 1) throw new SocialError("POST_NOT_DELETABLE", "Dit bericht wordt nu geplaatst. Probeer het straks opnieuw.", 409);
}

export async function duplicateSocialPost(id: string, adminUserId: string): Promise<SocialPostDto> {
  const source = await prisma.socialPost.findUnique({ where: { id }, include: { targets: true } });
  if (!source) throw new SocialError("POST_NOT_FOUND", "Dit bericht bestaat niet.", 404);
  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.socialPost.create({
      data: {
        title: `${source.title} (kopie)`.slice(0, 160),
        caption: source.caption,
        platformCaptions: source.platformCaptions ?? Prisma.DbNull,
        mediaIds: source.mediaIds,
        linkUrl: source.linkUrl,
        youtubeTitle: source.youtubeTitle,
        youtubePrivacy: source.youtubePrivacy,
        tiktokPrivacy: source.tiktokPrivacy,
        campaignId: source.campaignId,
        createdByAdminId: adminUserId,
      },
    });
    await syncTargets(tx, created.id, source.targets.map((target) => target.accountId));
    return created;
  });
  return getSocialPost(copy.id);
}

function assertPublishable(post: SocialPostDto) {
  if (!post.targets.length) throw new SocialError("NO_CHANNELS", "Kies minimaal één kanaal.", 422);
  const blocking = post.targets.filter((target) => target.status !== "PUBLISHED" && (post.problems[target.accountId] ?? []).length);
  if (blocking.length) {
    const first = blocking[0];
    throw new SocialError("NOT_PUBLISHABLE", `${first.accountName}: ${post.problems[first.accountId][0]}`, 422);
  }
}

export async function scheduleSocialPost(id: string, scheduledAt: string, deps: SocialDeps = defaultDeps): Promise<SocialPostDto> {
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new SocialError("INVALID_DATE", "Kies een geldig tijdstip.", 422);
  if (when.getTime() < deps.now().getTime() - 60_000) throw new SocialError("DATE_IN_PAST", "Kies een tijdstip in de toekomst, of gebruik Nu plaatsen.", 422);
  assertPublishable(await getSocialPost(id));
  const updated = await prisma.socialPost.updateMany({ where: { id, status: { in: EDITABLE } }, data: { status: "SCHEDULED", scheduledAt: when } });
  if (updated.count !== 1) throw new SocialError("POST_NOT_EDITABLE", "Dit bericht kan niet meer worden ingepland.", 409);
  await prisma.socialPostTarget.updateMany({ where: { postId: id, status: "FAILED" }, data: { status: "PENDING", error: null } });
  return getSocialPost(id);
}

export async function unscheduleSocialPost(id: string): Promise<SocialPostDto> {
  const updated = await prisma.socialPost.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "DRAFT", scheduledAt: null } });
  if (updated.count !== 1) throw new SocialError("POST_NOT_SCHEDULED", "Dit bericht staat niet ingepland.", 409);
  return getSocialPost(id);
}

/** Publishes now: schedules the post for this moment and runs it straight away. */
export async function publishSocialPostNow(id: string, deps: SocialDeps = defaultDeps): Promise<SocialPostDto> {
  await scheduleSocialPost(id, deps.now().toISOString(), deps);
  await publishDuePost(id, deps);
  return getSocialPost(id);
}

async function finishPost(postId: string, now: Date) {
  const targets = await prisma.socialPostTarget.findMany({ where: { postId } });
  const published = targets.filter((target) => target.status === "PUBLISHED").length;
  const pending = targets.filter((target) => target.status === "PENDING").length;
  const status = pending ? "SCHEDULED" : published === targets.length ? "PUBLISHED" : published ? "PARTIAL" : "FAILED";
  await prisma.socialPost.update({
    where: { id: postId },
    data: { status, ...(status === "PUBLISHED" || status === "PARTIAL" ? { publishedAt: now } : {}) },
  });
}

/** Publishes one due post to every channel that still needs it. */
export async function publishDuePost(id: string, deps: SocialDeps = defaultDeps): Promise<boolean> {
  const now = deps.now();
  const claimed = await prisma.socialPost.updateMany({ where: { id, status: "SCHEDULED", scheduledAt: { lte: now } }, data: { status: "PUBLISHING" } });
  if (claimed.count !== 1) return false;

  const post = await prisma.socialPost.findUniqueOrThrow({ where: { id }, include: { targets: { include: { account: true } } } });
  const media = await loadSocialMedia(post.mediaIds);
  const platformCaptions = captionsOf(post.platformCaptions);
  for (const target of post.targets) {
    if (target.status === "PUBLISHED") continue;
    const platform = target.account.platform as SocialPlatformName;
    await prisma.socialPostTarget.update({ where: { id: target.id }, data: { status: "PUBLISHING", attempts: { increment: 1 } } });
    try {
      const content = { caption: post.caption, platformCaptions, media, linkUrl: post.linkUrl, youtubeTitle: post.youtubeTitle };
      const problems = platformProblems(platform, content);
      if (problems.length) throw new SocialError("NOT_PUBLISHABLE", problems[0], 422);
      const result = await PUBLISHERS[platform]({
        account: {
          externalId: target.account.externalId,
          parentExternalId: target.account.parentExternalId,
          accessToken: await accessTokenFor(target.account, deps),
          username: target.account.username,
        },
        caption: captionFor(content, platform),
        youtubeTitle: youtubeTitleFor(content),
        media,
        linkUrl: post.linkUrl,
        youtubePrivacy: post.youtubePrivacy,
        tiktokPrivacy: post.tiktokPrivacy,
        fetchImpl: deps.fetchImpl,
      });
      await prisma.socialPostTarget.update({
        where: { id: target.id },
        data: { status: "PUBLISHED", externalId: result.externalId, permalink: result.permalink, error: null, publishedAt: deps.now() },
      });
    } catch (error) {
      const retry = error instanceof SocialError && error.retryable && target.attempts + 1 < MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.socialPostTarget.update({ where: { id: target.id }, data: { status: retry ? "PENDING" : "FAILED", error: message.slice(0, 1_000) } });
      if (error instanceof SocialError && error.code === "TOKEN_REJECTED") {
        await prisma.socialAccount.update({ where: { id: target.accountId }, data: { status: "EXPIRED", lastError: message.slice(0, 1_000) } });
      }
    }
  }
  await finishPost(id, deps.now());
  return true;
}

export async function retrySocialPost(id: string, deps: SocialDeps = defaultDeps): Promise<SocialPostDto> {
  const post = await prisma.socialPost.findUnique({ where: { id }, select: { status: true } });
  if (!post || !["FAILED", "PARTIAL"].includes(post.status)) throw new SocialError("POST_NOT_FAILED", "Alleen een mislukt bericht kan opnieuw worden geplaatst.", 409);
  await prisma.socialPostTarget.updateMany({ where: { postId: id, status: "FAILED" }, data: { status: "PENDING", error: null, attempts: 0 } });
  await prisma.socialPost.update({ where: { id }, data: { status: "SCHEDULED", scheduledAt: deps.now() } });
  await publishDuePost(id, deps);
  return getSocialPost(id);
}

export type SocialRunResult = { due: number; published: number; recovered: number };

/** Runs every due post; called by the scheduler every few minutes. Stops before the time budget runs out. */
export async function processDueSocialPosts(
  deps: SocialDeps = defaultDeps,
  budgetMs = 240_000,
  options: {
    /**
     * Page-view safety nets run after the response, when Cloud Run may throttle the CPU;
     * they only take quick posts and leave videos to the scheduler.
     */
    skipVideo?: boolean;
  } = {},
): Promise<SocialRunResult> {
  const started = Date.now();
  const now = deps.now();
  // Posts interrupted mid-publish are not retried blindly: the platform may already show them.
  const stuck = await prisma.socialPost.findMany({ where: { status: "PUBLISHING", updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } }, select: { id: true } });
  for (const post of stuck) {
    await prisma.socialPostTarget.updateMany({
      where: { postId: post.id, status: "PUBLISHING" },
      data: { status: "FAILED", error: "Plaatsen werd onderbroken. Controleer het kanaal voordat je het opnieuw probeert." },
    });
    await finishPost(post.id, now);
  }

  const due = await prisma.socialPost.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, select: { id: true, mediaIds: true }, orderBy: { scheduledAt: "asc" }, take: 20 });
  const videoIds = options.skipVideo
    ? new Set((await loadSocialMedia(due.flatMap((post) => post.mediaIds))).filter((asset) => socialMediaKind(asset.contentType) === "video").map((asset) => asset.id))
    : new Set<string>();
  let published = 0;
  for (const post of due) {
    if (Date.now() - started > budgetMs) break;
    if (post.mediaIds.some((id) => videoIds.has(id))) continue;
    if (await publishDuePost(post.id, deps)) published += 1;
  }
  return { due: due.length, published, recovered: stuck.length };
}

// ---------- Errors ----------

export function mapSocialError(error: unknown): { status: number; body: { error: string; message: string } } {
  if (error instanceof SocialError) return { status: error.status, body: { error: error.code, message: error.message } };
  if (error instanceof z.ZodError) return { status: 422, body: { error: "INVALID_INPUT", message: error.issues[0]?.message ?? "Controleer de invoer." } };
  console.error("Social: unexpected error", error);
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "Er ging iets mis. Probeer het opnieuw." } };
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}
