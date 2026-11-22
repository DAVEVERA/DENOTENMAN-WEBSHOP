import {
  buildProductResearchQueries,
  triageResearchCandidates,
  type ProductResearchTarget,
  type ResearchCandidate,
  type ReviewedResearchCandidate,
} from "./source-research";

export type SourceSearchResult =
  | { status: "not_configured"; queries: string[]; candidates: []; searchedAt: null }
  | { status: "complete" | "partial"; queries: string[]; candidates: ReviewedResearchCandidate[]; searchedAt: string; failures: number };

export type GroundingResponse = {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
};

function groundedCandidates(response: GroundingResponse, retrievedAt: string): ResearchCandidate[] {
  const chunks = response.candidates?.flatMap((item) => item.groundingMetadata?.groundingChunks ?? []) ?? [];
  const candidates: ResearchCandidate[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (typeof chunk.web?.uri !== "string") continue;
    let uri: URL;
    try { uri = new URL(chunk.web.uri); } catch { continue; }
    if (uri.protocol !== "https:" || uri.username || uri.password) continue;
    if (!uri.hostname || uri.hostname === "localhost" || uri.hostname.endsWith(".local")) continue;
    const normalized = uri.href.replace(/\/$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({
      url: uri.href,
      title: typeof chunk.web.title === "string" ? chunk.web.title.slice(0, 300) : uri.hostname,
      excerpt: "",
      sourceType: "unknown",
      retrievedAt,
    });
  }
  return candidates;
}

/** Google Search Grounding reuses the existing server-side GEMINI_API_KEY.
 * Results are unverified source candidates, never product facts.
 */
export async function searchProductSources(
  target: ProductResearchTarget,
  options: {
    apiKey?: string;
    clock?: () => Date;
    model?: string;
    generate?: (request: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }) => Promise<GroundingResponse>;
  } = {},
): Promise<SourceSearchResult> {
  const queries = buildProductResearchQueries(target).slice(0, 2);
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return { status: "not_configured", queries, candidates: [], searchedAt: null };
  }
  const searchedAt = (options.clock ?? (() => new Date()))().toISOString();
  if (!queries.length) return { status: "complete", queries, candidates: [], searchedAt, failures: 0 };

  const model = options.model ?? process.env.AI_VISIBILITY_GEMINI_MODEL?.trim() ?? "gemini-2.5-flash";
  try {
    const generate = options.generate ?? (async (request: {
      model: string; contents: string; config: Record<string, unknown>;
    }): Promise<GroundingResponse> => {
      const { GoogleGenAI } = await import("@google/genai");
      const response = await new GoogleGenAI({ apiKey }).models.generateContent(request as never);
      return response as GroundingResponse;
    });

    const response = await generate({
      model,
      contents: [
        "Zoek op internet naar een primaire productspecificatie of leveranciersetiket voor exact dit product en deze variant.",
        "Dit is uitsluitend brononderzoek, niet een opdracht om ontbrekende productfeiten te verzinnen.",
        "Kies indien mogelijk een officiële fabrikant- of leveranciersbron en verwijs naar gevonden documenten.",
        "Geef geen onbevestigde ingrediënten, allergenen of voedingswaarden als feit.",
        `Product: ${target.productName}; SKU: ${target.sku}; variant-ID: ${target.variantId}; gewicht: ${target.weightGrams ?? "onbekend"}g; te onderzoeken veld: ${target.field}.`,
        `Gerichte zoekopdrachten: ${queries.join(" | ")}`,
      ].join("\n"),
      config: {
        tools: [{ googleSearch: {} }],
        abortSignal: AbortSignal.timeout(25_000),
        temperature: 0,
      },
    });
    // Only grounded URLs are exposed. The model's prose does not verify product identity.
    const candidates = groundedCandidates(response, searchedAt);
    const grounded = response.candidates?.some((item) =>
      (item.groundingMetadata?.groundingChunks?.length ?? 0) > 0
    ) ?? false;
    return {
      status: grounded ? "complete" : "partial",
      queries,
      candidates: triageResearchCandidates(target, candidates),
      searchedAt,
      failures: grounded ? 0 : 1,
    };
  } catch {
    return { status: "partial", queries, candidates: [], searchedAt, failures: 1 };
  }
}
