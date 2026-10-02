import { ZodError } from "zod";

import {
  copywriterProviderJsonSchema,
  type CopywriterPersistedProposal,
} from "./schema";
import type { CopywriterSourceSnapshot } from "./snapshot";
import {
  CopywriterGroundingError,
  buildCopywriterPrompt,
  buildGroundedCopywriterProposal,
  copywriterGroundingFeedback,
  repairCopywriterProviderOutput,
} from "./style";

type CopywriterGeminiRequest = {
  model: string;
  contents: unknown;
  config: Record<string, unknown>;
};

export type CopywriterGenerate = (
  request: CopywriterGeminiRequest,
) => Promise<{ text?: string; requestId?: string }>;

export class CopywriterProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "CopywriterProviderError";
  }
}

function configuredKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key && key !== "MY_GEMINI_API_KEY" ? key : null;
}

export function isCopywriterGeminiConfigured(): boolean {
  return configuredKey() !== null;
}

function modelId(): string {
  return process.env.COPYWRITER_GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

async function defaultGenerate(
  request: CopywriterGeminiRequest,
): Promise<{ text?: string; requestId?: string }> {
  const apiKey = configuredKey();
  if (!apiKey) {
    throw new CopywriterProviderError(
      "COPYWRITER_NOT_CONFIGURED",
      "Gemini is niet geconfigureerd voor De Notenman CopyWriter.",
      503,
    );
  }
  const { GoogleGenAI } = await import("@google/genai");
  const response = await new GoogleGenAI({ apiKey }).models.generateContent(
    request as never,
  );
  const metadata = response as unknown as {
    text?: string;
    responseId?: string;
  };
  return { text: metadata.text, requestId: metadata.responseId };
}

function parseResponse(text: string | undefined): unknown {
  try {
    return JSON.parse(text?.trim() || "");
  } catch {
    throw new CopywriterProviderError(
      "INVALID_PROVIDER_RESPONSE",
      "Gemini gaf geen geldig CopyWriter-voorstel terug.",
    );
  }
}

// Codes only, never product text, so the logs show why an attempt failed.
function failureSummary(error: unknown): { code: string; field?: string; detail?: string } {
  if (error instanceof CopywriterGroundingError) return { code: error.code, field: error.field, detail: error.detail };
  if (error instanceof ZodError) return { code: "SCHEMA_INVALID", field: error.issues[0]?.path.join(".") };
  const candidate = error as { code?: unknown; status?: unknown; name?: unknown } | null;
  return { code: String(candidate?.code ?? candidate?.status ?? candidate?.name ?? "UNKNOWN") };
}

function mapError(error: unknown): CopywriterProviderError {
  if (error instanceof CopywriterProviderError) return error;
  if (error instanceof ZodError) {
    return new CopywriterProviderError(
      "INVALID_PROVIDER_RESPONSE",
      "Gemini gaf geen geldig CopyWriter-voorstel terug. Probeer het opnieuw.",
    );
  }
  if (error instanceof CopywriterGroundingError) {
    return new CopywriterProviderError(
      "UNSAFE_PROPOSAL_REJECTED",
      "Het voorstel bevat tekst die niet veilig aan de productbron is te koppelen.",
      422,
    );
  }
  const candidate = error as { name?: string; code?: string; status?: number };
  // AbortSignal.timeout() rejects with a TimeoutError, a manual abort with an AbortError.
  if (candidate?.name === "AbortError" || candidate?.name === "TimeoutError" || candidate?.code === "ABORT_ERR") {
    return new CopywriterProviderError(
      "PROVIDER_TIMEOUT",
      "Gemini reageerde niet op tijd.",
      504,
    );
  }
  if (candidate?.status === 429) {
    return new CopywriterProviderError(
      "PROVIDER_RATE_LIMITED",
      "Gemini heeft tijdelijk geen ruimte. Probeer het later opnieuw.",
      429,
    );
  }
  if (candidate?.status && candidate.status >= 400 && candidate.status < 500) {
    return new CopywriterProviderError(
      "PROVIDER_REJECTED",
      "Gemini kon deze CopyWriter-aanvraag niet verwerken.",
      422,
    );
  }
  return new CopywriterProviderError(
    "PROVIDER_UNAVAILABLE",
    "Gemini is tijdelijk niet beschikbaar.",
    502,
  );
}

const RETRY_DELAY_MS = 1_500;
const MAX_ATTEMPTS = 3;
const RETRY_BUDGET_MS = 150_000;

export async function runCopywriterGeneration(
  snapshot: CopywriterSourceSnapshot,
  generate: CopywriterGenerate = defaultGenerate,
): Promise<{
  proposal: CopywriterPersistedProposal;
  modelId: string;
  providerRequestId?: string;
}> {
  if (!configuredKey()) {
    throw new CopywriterProviderError(
      "COPYWRITER_NOT_CONFIGURED",
      "Gemini is niet geconfigureerd voor De Notenman CopyWriter.",
      503,
    );
  }
  const prompt = buildCopywriterPrompt(snapshot);
  const model = modelId();
  const request = (feedback: string | null) => generate({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt.system }, { text: prompt.prompt }, ...(feedback ? [{ text: feedback }] : [])],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: copywriterProviderJsonSchema,
      abortSignal: AbortSignal.timeout(60_000),
    },
  });
  const send = async (feedback: string | null) => {
    try {
      return await request(feedback);
    } catch (error) {
      // One retry for a busy (429) or failing (5xx) provider; everything else is final.
      const status = (error as { status?: number } | null)?.status ?? 0;
      if (status !== 429 && status < 500) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return request(feedback);
    }
  };

  const startedAt = Date.now();
  let feedback: string | null = null;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await send(feedback);
      const repaired = repairCopywriterProviderOutput(snapshot, parseResponse(response.text));
      return {
        proposal: buildGroundedCopywriterProposal(snapshot, repaired),
        modelId: model,
        providerRequestId: response.requestId,
      };
    } catch (error) {
      const rejected = error instanceof CopywriterGroundingError || error instanceof ZodError
        || (error instanceof CopywriterProviderError && error.code === "INVALID_PROVIDER_RESPONSE");
      console.warn("CopyWriter: generation attempt failed", { productId: snapshot.product.id, attempt, ...failureSummary(error) });
      // A rejected proposal is written again with the reason, while there is time left.
      if (!rejected || attempt >= MAX_ATTEMPTS || Date.now() - startedAt > RETRY_BUDGET_MS) throw mapError(error);
      feedback = error instanceof CopywriterGroundingError
        ? copywriterGroundingFeedback(error)
        : "Je vorige antwoord paste niet in het gevraagde JSON-schema. Lever precies het schema, met alle velden.";
    }
  }
}
