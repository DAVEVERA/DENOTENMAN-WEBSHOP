import type { SocialFetch } from "../api-client";
import type { SocialPlatformName } from "../platforms";

export type ConnectedAccountInput = {
  platform: SocialPlatformName;
  externalId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  parentExternalId?: string | null;
};

export type RefreshedToken = { accessToken: string; refreshToken?: string | null; expiresAt: Date | null };

export type SocialConnection = {
  /** Route segment: /api/admin/social/connect/<key>. */
  key: "meta" | "tiktok" | "youtube";
  label: string;
  platforms: SocialPlatformName[];
  /** Environment variables that must be set before connecting. */
  requiredEnv: string[];
  authorizeUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string, fetchImpl?: SocialFetch): Promise<ConnectedAccountInput[]>;
  refresh?(refreshToken: string, fetchImpl?: SocialFetch): Promise<RefreshedToken>;
};

export type PublishMedia = {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

export type PublishContext = {
  account: { externalId: string; parentExternalId: string | null; accessToken: string; username: string | null };
  caption: string;
  youtubeTitle: string;
  media: PublishMedia[];
  linkUrl: string | null;
  youtubePrivacy: string;
  tiktokPrivacy: string;
  fetchImpl?: SocialFetch;
};

export type PublishResult = { externalId: string; permalink: string | null };

export function missingEnv(names: string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim());
}
