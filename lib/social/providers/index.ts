import "server-only";

import type { SocialPlatformName } from "../platforms";
import { metaConnection, publishToFacebook, publishToInstagram } from "./meta";
import { publishToTikTok, tiktokConnection } from "./tiktok";
import { missingEnv, type PublishContext, type PublishResult, type SocialConnection } from "./types";
import { publishToYouTube, youtubeConnection } from "./youtube";

export const SOCIAL_CONNECTIONS: SocialConnection[] = [metaConnection, tiktokConnection, youtubeConnection];

export function connectionByKey(key: string): SocialConnection | null {
  return SOCIAL_CONNECTIONS.find((connection) => connection.key === key) ?? null;
}

export function connectionForPlatform(platform: SocialPlatformName): SocialConnection {
  return SOCIAL_CONNECTIONS.find((connection) => connection.platforms.includes(platform))!;
}

export function connectionStatus(connection: SocialConnection) {
  const missing = missingEnv(connection.requiredEnv);
  return { key: connection.key, label: connection.label, platforms: connection.platforms, configured: missing.length === 0, missingEnv: missing };
}

export const PUBLISHERS: Record<SocialPlatformName, (context: PublishContext) => Promise<PublishResult>> = {
  FACEBOOK: publishToFacebook,
  INSTAGRAM: publishToInstagram,
  TIKTOK: publishToTikTok,
  YOUTUBE: publishToYouTube,
};
