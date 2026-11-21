import {
  buildProductResearchQueries,
  triageResearchCandidates,
  type ProductResearchTarget,
  type ResearchCandidate,
  type ReviewedResearchCandidate,
} from "./source-research";

const SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export type SourceSearchResult =
  | { status: "not_configured"; queries: string[]; candidates: []; searchedAt: null }
  | { status: "complete" | "partial"; queries: string[]; candidates: ReviewedResearchCandidate[]; searchedAt: string; failures: number };

type BraveResult = { title?: unknown; url?: unknown; description?: unknown };
type BraveResponse = { web?: { results?: BraveResult[] } };

function candidateFromResult(item: BraveResult, retrievedAt: string): ResearchCandidate | null {
  if (typeof item.url !== "string" || typeof item.title !== "string") return null;
  let uri: URL;
  try { uri = new URL(item.url); } catch { return null; }
  if (uri.protocol !== "https:" && uri.protocol !== "http:") return null;
  if (uri.username || uri.password) return null;
  if (!uri.hostname || uri.hostname === "localhost" || uri.hostname.endsWith(".local")) return null;
  return {
    url: uri.href,
    title: item.title.slice(0, 300),
    excerpt: typeof item.description === "string" ? item.description.slice(0, 1500) : "",
    // A search provider cannot certify a source as a manufacturer, supplier or label.
    // Keep it unknown until separately confirmed against product identity.
    sourceType: "unknown",
    retrievedAt,
  };
}

/** Read-only research: no stored updates, no arbitrary URLs or browser-exposed keys. */
export async function searchProductSources(
  target: ProductResearchTarget,
  options: {
    apiKey?: string;
    fetcher?: typeof fetch;
    clock?: () => Date;
    maxQueries?: number;
  } = {},
): Promise<SourceSearchResult> {
  const queries = buildProductResearchQueries(target).slice(0, Math.max(1, Math.min(3, Math.floor(options.maxQueries ?? 2))));
  const apiKey = options.apiKey?.trim() ?? process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) return { status: "not_configured", queries, candidates: [], searchedAt: null };

  const fetcher = options.fetcher ?? fetch;
  const searchedAt = (options.clock ?? (() => new Date()))().toISOString();
  let failures = 0;
  const results: ResearchCandidate[] = [];
  for (const query of queries) {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set("q", query.slice(0, 600));
    url.searchParams.set("count", "5");
    url.searchParams.set("country", "NL");
    try {
      const response = await fetcher(url, {
        method: "GET",
        headers: { "Accept": "application/json", "X-Subscription-Token": apiKey },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) { failures++; continue; }
      const data = await response.json() as BraveResponse;
      for (const item of data.web?.results ?? []) {
        const candidate = candidateFromResult(item, searchedAt);
        if (candidate) results.push(candidate);
      }
    } catch {
      failures++;
    }
  }
  // Deduplicate by normalized URL, preserving the first search hit.
  const unique = [...new Map([...results].reverse().map((item) => [item.url.replace(/\/$/, ""), item])).values()];
  return {
    status: failures ? "partial" : "complete",
    queries,
    candidates: triageResearchCandidates(target, unique),
    searchedAt,
    failures,
  };
}
