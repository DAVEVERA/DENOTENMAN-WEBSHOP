// Platform rules for the social poster. Pure functions, shared by the server and the composer.

export const SOCIAL_PLATFORMS = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE"] as const;
export type SocialPlatformName = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const SOCIAL_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const SOCIAL_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const SOCIAL_MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

export type SocialMediaKind = "image" | "video";

export function socialMediaKind(contentType: string): SocialMediaKind | null {
  if ((SOCIAL_IMAGE_TYPES as readonly string[]).includes(contentType)) return "image";
  if ((SOCIAL_VIDEO_TYPES as readonly string[]).includes(contentType)) return "video";
  return null;
}

export const SOCIAL_PLATFORM_INFO: Record<SocialPlatformName, {
  label: string;
  captionLimit: number;
  /** What the platform can publish, in plain Dutch for the composer. */
  accepts: string;
}> = {
  FACEBOOK: { label: "Facebook", captionLimit: 63_206, accepts: "Tekst, link, tot 10 foto's of één video" },
  INSTAGRAM: { label: "Instagram", captionLimit: 2_200, accepts: "Eén foto, een carrousel van 2 tot 10 foto's of één video (Reel)" },
  TIKTOK: { label: "TikTok", captionLimit: 2_200, accepts: "Eén video" },
  YOUTUBE: { label: "YouTube", captionLimit: 5_000, accepts: "Eén video met een titel" },
};

export const YOUTUBE_TITLE_LIMIT = 100;
export const YOUTUBE_PRIVACY = ["public", "unlisted", "private"] as const;
export const TIKTOK_PRIVACY = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"] as const;

export type SocialPostContent = {
  caption: string;
  platformCaptions?: Partial<Record<SocialPlatformName, string>> | null;
  media: Array<{ contentType: string }>;
  linkUrl?: string | null;
  youtubeTitle?: string | null;
};

export function captionFor(post: Pick<SocialPostContent, "caption" | "platformCaptions">, platform: SocialPlatformName): string {
  const override = post.platformCaptions?.[platform]?.trim();
  return override || post.caption.trim();
}

/** YouTube needs a title: the explicit one, or the first line of the caption. */
export function youtubeTitleFor(post: Pick<SocialPostContent, "caption" | "platformCaptions" | "youtubeTitle">): string {
  const explicit = post.youtubeTitle?.trim();
  if (explicit) return explicit;
  return captionFor(post, "YOUTUBE").split(/\r?\n/u)[0]?.trim().slice(0, YOUTUBE_TITLE_LIMIT) ?? "";
}

/** Everything that stops a post from being published on this platform, in Dutch. */
export function platformProblems(platform: SocialPlatformName, post: SocialPostContent): string[] {
  const problems: string[] = [];
  const caption = captionFor(post, platform);
  const kinds = post.media.map((item) => socialMediaKind(item.contentType));
  const images = kinds.filter((kind) => kind === "image").length;
  const videos = kinds.filter((kind) => kind === "video").length;
  const info = SOCIAL_PLATFORM_INFO[platform];

  if (caption.length > info.captionLimit) problems.push(`De tekst is te lang voor ${info.label} (maximaal ${info.captionLimit.toLocaleString("nl-NL")} tekens).`);
  if (images && videos) problems.push(`${info.label} kan foto's en video niet in één bericht combineren.`);

  switch (platform) {
    case "FACEBOOK":
      if (!caption && !post.media.length && !post.linkUrl) problems.push("Voeg tekst, een link of media toe.");
      if (images > 10) problems.push("Facebook plaatst maximaal 10 foto's per bericht.");
      if (videos > 1) problems.push("Facebook plaatst één video per bericht.");
      break;
    case "INSTAGRAM":
      if (!post.media.length) problems.push("Instagram heeft minimaal één foto of video nodig.");
      if (images > 10) problems.push("Een Instagram-carrousel heeft maximaal 10 foto's.");
      if (videos > 1) problems.push("Instagram plaatst één video per bericht.");
      if ((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30) problems.push("Instagram staat maximaal 30 hashtags toe.");
      break;
    case "TIKTOK":
      if (videos !== 1 || images) problems.push("TikTok heeft precies één video nodig.");
      break;
    case "YOUTUBE": {
      if (videos !== 1 || images) problems.push("YouTube heeft precies één video nodig.");
      const title = youtubeTitleFor(post);
      if (!title) problems.push("Geef de YouTube-video een titel.");
      if (title.length > YOUTUBE_TITLE_LIMIT) problems.push(`De YouTube-titel is te lang (maximaal ${YOUTUBE_TITLE_LIMIT} tekens).`);
      if (/[<>]/u.test(title) || /[<>]/u.test(caption)) problems.push("YouTube accepteert geen < of > in titel en beschrijving.");
      break;
    }
  }
  return problems;
}

/** TikTok's chunk rules: 5–64 MB per chunk, the last chunk takes the remainder. */
export function tiktokChunkPlan(size: number): { chunkSize: number; count: number } {
  const MB = 1024 * 1024;
  if (size <= 64 * MB) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * MB;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}
