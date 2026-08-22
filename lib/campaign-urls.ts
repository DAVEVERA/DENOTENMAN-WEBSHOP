export type CampaignParameters = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
};
export function campaignSlug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "denotenman"
  );
}

function normalizedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function addCampaignParametersToOwnedUrl(
  target: string,
  siteUrl: string,
  parameters: CampaignParameters
): string {
  try {
    const base = new URL(siteUrl);
    const absoluteTarget = /^[a-z][a-z\d+.-]*:/i.test(target);
    const url = new URL(target, base);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      normalizedHostname(url.hostname) !== normalizedHostname(base.hostname)
    ) {
      return target;
    }

    url.searchParams.set("utm_source", campaignSlug(parameters.source));
    url.searchParams.set("utm_medium", campaignSlug(parameters.medium));
    url.searchParams.set("utm_campaign", campaignSlug(parameters.campaign));
    if (parameters.content) {
      url.searchParams.set("utm_content", campaignSlug(parameters.content));
    }

    return absoluteTarget ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return target;
  }
}
