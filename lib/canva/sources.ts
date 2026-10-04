/** Our own public images only: the media bucket or this site. Never an arbitrary address. */
export function isOwnImageUrl(rawUrl: string, environment: Record<string, string | undefined> = process.env): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const allowed = [environment.CDN_BASE_URL, environment.SITE_URL]
      .filter((value): value is string => Boolean(value))
      .map((value) => new URL(value));
    return allowed.some((base) => {
      const prefix = base.pathname.replace(/\/+$/u, "");
      return url.origin === base.origin && (prefix === "" || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    });
  } catch {
    return false;
  }
}
