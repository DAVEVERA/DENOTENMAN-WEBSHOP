// Gemini models regularly answer "high demand" (503) or rate limits (429) for minutes at
// a time. A busy model is skipped for the next one in the chain, and the chain is tried
// again after a short pause, as long as the time budget allows.

// Slow or often hung models go last; the lite model is the last resort.
export const GEMINI_FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash", "gemini-3.5-flash-lite"] as const;

/** The primary model first, then the fallbacks (GEMINI_FALLBACK_MODELS overrides them, comma-separated). */
export function geminiModelChain(primary: string, configured = process.env.GEMINI_FALLBACK_MODELS): string[] {
  const fallbacks = configured?.split(",").map((model) => model.trim()).filter(Boolean) ?? GEMINI_FALLBACK_MODELS;
  return [...new Set([primary, ...fallbacks])];
}

function statusOf(error: unknown): number {
  const status = (error as { status?: unknown; code?: unknown } | null)?.status;
  return typeof status === "number" ? status : 0;
}

/** Busy, rate limited, failing or too slow: worth trying another model or a bit later. */
export function isBusyGeminiError(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string } | null;
  const status = statusOf(error);
  return status === 429 || status >= 500
    || candidate?.name === "TimeoutError" || candidate?.name === "AbortError" || candidate?.code === "ABORT_ERR";
}

export async function withGeminiModelFallback<T>(
  primary: string,
  run: (model: string) => Promise<T>,
  options: {
    budgetMs?: number;
    rounds?: number;
    pauseMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onFailure?: (model: string, error: unknown) => void;
  } = {},
): Promise<{ result: T; model: string }> {
  const { budgetMs = 80_000, rounds = 2, pauseMs = 2_000 } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const models = geminiModelChain(primary);
  const startedAt = Date.now();
  let lastError: unknown = null;
  for (let round = 0; round < rounds; round += 1) {
    if (round > 0) await sleep(pauseMs);
    for (const model of models) {
      if (lastError && Date.now() - startedAt > budgetMs) throw lastError;
      try {
        return { result: await run(model), model };
      } catch (error) {
        // A fallback model that no longer exists is skipped; the primary one is a real error.
        const retired = model !== primary && statusOf(error) === 404;
        if (!isBusyGeminiError(error) && !retired) throw error;
        lastError = error;
        options.onFailure?.(model, error);
      }
    }
  }
  throw lastError;
}
