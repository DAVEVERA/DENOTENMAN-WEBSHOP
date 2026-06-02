export type AttributionInput = {
  url: string;
  referrer?: string | null;
};

export function parseAttribution(input: AttributionInput) {
  const url = new URL(input.url);
  return {
    source: url.searchParams.get("utm_source") ?? input.referrer ?? "direct",
    medium: url.searchParams.get("utm_medium") ?? null,
    campaign: url.searchParams.get("utm_campaign") ?? null,
    term: url.searchParams.get("utm_term") ?? null,
    content: url.searchParams.get("utm_content") ?? null,
  };
}
