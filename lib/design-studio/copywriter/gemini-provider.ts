import {
  copywriterProviderJsonSchema,
  type CopywriterPersistedProposal,
} from "./schema";
import type { CopywriterSourceSnapshot } from "./snapshot";
import {
  CopywriterGroundingError,
  buildCopywriterPrompt,
  buildGroundedCopywriterProposal,
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

function mapError(error: unknown): CopywriterProviderError {
  if (error instanceof CopywriterProviderError) return error;
  if (error instanceof CopywriterGroundingError) {
    return new CopywriterProviderError(
      "UNSAFE_PROPOSAL_REJECTED",
      "Het voorstel bevat tekst die niet veilig aan de productbron is te koppelen.",
      422,
    );
  }
  const candidate = error as { name?: string; code?: string; status?: number };
  if (candidate?.name === "AbortError" || candidate?.code === "ABORT_ERR") {
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
  try {
    const response = await generate({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt.system }, { text: prompt.prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: copywriterProviderJsonSchema,
        abortSignal: AbortSignal.timeout(60_000),
      },
    });
    return {
      proposal: buildGroundedCopywriterProposal(
        snapshot,
        parseResponse(response.text),
      ),
      modelId: model,
      providerRequestId: response.requestId,
    };
  } catch (error) {
    throw mapError(error);
  }
}
