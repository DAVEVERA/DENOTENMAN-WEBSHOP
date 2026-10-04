import "server-only";

import { z } from "zod";

import { openWithPurpose, sealWithPurpose } from "@/lib/secret-box";
import { getSetting, setSetting } from "@/lib/settings";
import { CanvaApi, CanvaError, refreshCanvaTokens, revokeCanvaToken, type CanvaTokens } from "./api";
import { canvaConfig } from "./config";

// One Canva account for the whole shop, connected by an owner or admin, like the
// social channels. Tokens are sealed with AES-256-GCM in AppSetting and never reach
// a browser.

const SETTING_KEY = "canva.connection";
const PURPOSE = "canva-connection";
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

const storedSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  scope: z.string(),
  canvaUserId: z.string().nullable(),
  teamId: z.string().nullable(),
  displayName: z.string().nullable(),
  connectedByAdminId: z.string().nullable(),
  connectedAt: z.string(),
});

export type StoredCanvaConnection = z.infer<typeof storedSchema>;

export type CanvaConnectionSummary = {
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
};

export async function loadCanvaConnection(): Promise<StoredCanvaConnection | null> {
  const opened = openWithPurpose(await getSetting(SETTING_KEY), PURPOSE);
  if (!opened) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(opened));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function storeCanvaConnection(connection: StoredCanvaConnection | null): Promise<void> {
  await setSetting(SETTING_KEY, connection ? sealWithPurpose(JSON.stringify(connection), PURPOSE) : "");
}

export async function canvaConnectionSummary(): Promise<CanvaConnectionSummary> {
  const configured = canvaConfig() !== null;
  const connection = configured ? await loadCanvaConnection().catch(() => null) : null;
  return { configured, connected: Boolean(connection), displayName: connection?.displayName ?? null, connectedAt: connection?.connectedAt ?? null };
}

export async function saveNewCanvaConnection(tokens: CanvaTokens, adminId: string): Promise<StoredCanvaConnection> {
  const profile = await new CanvaApi(async () => tokens.accessToken).profile().catch(() => ({ userId: null, teamId: null, displayName: null }));
  const connection: StoredCanvaConnection = {
    ...tokens,
    canvaUserId: profile.userId,
    teamId: profile.teamId,
    displayName: profile.displayName,
    connectedByAdminId: adminId,
    connectedAt: new Date().toISOString(),
  };
  await storeCanvaConnection(connection);
  return connection;
}

export async function disconnectCanva(): Promise<void> {
  const config = canvaConfig();
  const connection = await loadCanvaConnection();
  await storeCanvaConnection(null);
  if (config && connection) await revokeCanvaToken(config, connection.refreshToken);
}

let refreshing: Promise<string> | null = null;

/**
 * A valid access token, refreshed shortly before it expires. Concurrent callers in
 * this instance share one refresh, because Canva refresh tokens work only once.
 */
export async function canvaAccessToken(options: { force?: boolean } = {}): Promise<string> {
  const config = canvaConfig();
  if (!config) throw new CanvaError("CANVA_NOT_CONFIGURED", "Canva is nog niet ingesteld op de server.", 503);
  const connection = await loadCanvaConnection();
  if (!connection) throw new CanvaError("CANVA_NOT_CONNECTED", "Koppel eerst een Canva-account.", 409);
  if (!options.force && connection.expiresAt - REFRESH_MARGIN_MS > Date.now()) return connection.accessToken;
  refreshing ??= (async () => {
    try {
      const tokens = await refreshCanvaTokens(config, connection.refreshToken);
      await storeCanvaConnection({ ...connection, ...tokens });
      return tokens.accessToken;
    } catch (error) {
      // Another instance may have refreshed first; use its token when it is newer.
      const latest = await loadCanvaConnection();
      if (latest && latest.refreshToken !== connection.refreshToken && latest.expiresAt > Date.now()) return latest.accessToken;
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export function canvaApi(): CanvaApi {
  return new CanvaApi(canvaAccessToken);
}
