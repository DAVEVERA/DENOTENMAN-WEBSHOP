import type { ProductAuditAiBoundary } from "@/lib/product-audit-core";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 1_000_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class ProductAuditOpenAIError extends Error {
  constructor(
    public readonly code:
      | "OPENAI_API_KEY_MISSING"
      | "OPENAI_CREDITS_EXHAUSTED"
      | "OPENAI_RATE_LIMITED"
      | "OPENAI_REQUEST_FAILED"
      | "OPENAI_INVALID_STRUCTURED_OUTPUT",
    public readonly status: number,
    message: string = code
  ) {
    super(message);
    this.name = "ProductAuditOpenAIError";
  }
}

function outputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const response = body as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

async function fetchWithTimeout(fetchImpl: FetchLike, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(OPENAI_RESPONSES_URL, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProductAuditOpenAIError("OPENAI_REQUEST_FAILED", 504, "OPENAI_REQUEST_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOpenAIProductAuditBoundary({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_AUDIT_MODEL?.trim() || DEFAULT_MODEL,
  fetchImpl = fetch,
}: {
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike;
} = {}): ProductAuditAiBoundary {
  return {
    model,
    async generateStructured(input) {
      const key = apiKey?.trim();
      if (!key) throw new ProductAuditOpenAIError("OPENAI_API_KEY_MISSING", 503);

      const response = await fetchWithTimeout(fetchImpl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: input.system,
          input: input.prompt,
          text: {
            format: {
              type: "json_schema",
              name: "product_content_audit",
              strict: true,
              schema: input.schema,
            },
          },
          max_output_tokens: 5000,
        }),
      });

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) {
        throw new ProductAuditOpenAIError("OPENAI_INVALID_STRUCTURED_OUTPUT", 502);
      }
      const body = await response.json().catch(() => null) as {
        error?: { code?: unknown; message?: unknown };
        output_text?: unknown;
        output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
      } | null;
      if (!response.ok) {
        const upstreamCode = typeof body?.error?.code === "string" ? body.error.code : undefined;
        console.error("OpenAI product audit request failed", {
          status: response.status,
          requestId: response.headers.get("x-request-id"),
          upstreamCode,
        });
        if (upstreamCode === "credit_balance_exhausted") {
          throw new ProductAuditOpenAIError("OPENAI_CREDITS_EXHAUSTED", 402);
        }
        if (response.status === 429) throw new ProductAuditOpenAIError("OPENAI_RATE_LIMITED", 429);
        throw new ProductAuditOpenAIError("OPENAI_REQUEST_FAILED", 502);
      }

      const text = outputText(body);
      if (!text || text.length > MAX_RESPONSE_BYTES) {
        throw new ProductAuditOpenAIError("OPENAI_INVALID_STRUCTURED_OUTPUT", 502);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new ProductAuditOpenAIError("OPENAI_INVALID_STRUCTURED_OUTPUT", 502);
      }
    },
  };
}
