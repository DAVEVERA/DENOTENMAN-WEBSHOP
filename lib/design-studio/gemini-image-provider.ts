import "server-only";

import sharp from "@/lib/sharp";
import { z } from "zod";
import type { GeminiImageJobInput } from "@/lib/design-studio/gemini-image-schema";
import type { GeminiImageAvailability } from "@/lib/design-studio/types";

const INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
const REQUEST_TIMEOUT_MS = 120_000;
const STATUS_TIMEOUT_MS = 15_000;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;
const MAX_SOURCE_SIDE = 2_048;
const MAX_OUTPUT_SIDE = 5_000;

const modelsResponseSchema = z.object({
  models: z.array(z.object({ name: z.string() })).default([]),
});

const interactionResponseSchema = z.object({
  id: z.string().trim().min(1).max(300).optional(),
  output_image: z.object({
    data: z.string().min(1),
    mime_type: z.string().optional(),
  }).optional(),
  output_text: z.string().optional(),
});

const presetInstructions: Record<GeminiImageJobInput["preset"], string> = {
  catalog: "Create a photorealistic premium studio product photograph on a clean warm-white background, with accurate scale, crisp natural detail, a soft contact shadow and even spacing.",
  editorial: "Create a refined editorial product photograph using warm natural materials, tactile detail and restrained styling.",
  lifestyle: "Place the product in a credible Dutch serving moment with natural daylight, human warmth and an uncluttered table setting.",
  seasonal: "Create a tasteful seasonal campaign scene with subtle ingredients and generous clean copy space, but do not render any text.",
  social: "Create a bold, immediately readable social-media composition with one clear product focal point and controlled depth.",
  hero: "Create a wide commercial hero composition with the product clearly visible on the right and calm negative space on the left for real HTML copy.",
};

export class GeminiImageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "GeminiImageError";
  }
}

function apiKey(): string {
  const value = process.env.GEMINI_API_KEY?.trim();
  if (!value || value === "MY_GEMINI_API_KEY") {
    throw new GeminiImageError("NOT_CONFIGURED", "Gemini Image is nog niet geconfigureerd.", 503);
  }
  return value;
}

export async function getGeminiImageAvailability(fetchImpl: typeof fetch = fetch): Promise<GeminiImageAvailability> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === "MY_GEMINI_API_KEY") return { status: "not_configured", availableModels: [] };

  let response: Response;
  try {
    response = await fetchImpl(MODELS_ENDPOINT, {
      method: "GET",
      headers: { "x-goog-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
  } catch {
    return { status: "unavailable", availableModels: [] };
  }
  if (response.status === 401 || response.status === 403) {
    return { status: "invalid_configuration", availableModels: [] };
  }
  if (!response.ok) return { status: "unavailable", availableModels: [] };

  const parsed = modelsResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return { status: "unavailable", availableModels: [] };
  const availableModels = parsed.data.models
    .map((model) => model.name.replace(/^models\//, ""))
    .filter((name) => name === "gemini-3.1-flash-image" || name === "gemini-3-pro-image");
  return {
    status: availableModels.includes("gemini-3.1-flash-image") ? "ready" : "unavailable",
    availableModels,
  };
}

function productPrompt(productName: string, options: GeminiImageJobInput): string {
  const brief = options.brief
    ? `Creative brief: ${options.brief}`
    : "Creative brief: keep the image timeless, credible and conversion-focused.";
  return [
    `Create a commercial product photograph for De Notenman using the supplied reference image of ${productName}.`,
    "The reference product is authoritative. Preserve the exact product identity, packaging, label, logo, colors, proportions, quantity and recognizable food texture.",
    presetInstructions[options.preset],
    brief,
    "Warm cream, natural wood and deep charcoal may support the brand, while the product remains the single focal point.",
    "Do not invent or rewrite labels. Do not alter the logo. Do not add a watermark, price, slogan, typography, duplicate package, fake UI or unsafe content.",
  ].join(" ");
}

async function normalizeSource(sourceBytes: Buffer): Promise<Buffer> {
  if (sourceBytes.length === 0 || sourceBytes.length > MAX_SOURCE_BYTES) {
    throw new GeminiImageError("INVALID_SOURCE", "De bronafbeelding is leeg of groter dan 30 MB.", 422);
  }
  try {
    return await sharp(sourceBytes, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_SOURCE_SIDE, height: MAX_SOURCE_SIDE, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();
  } catch {
    throw new GeminiImageError("INVALID_SOURCE", "De bronafbeelding kon niet veilig worden gelezen.", 422);
  }
}

function providerFailure(status: number): GeminiImageError {
  if (status === 401 || status === 403) {
    return new GeminiImageError("INVALID_CONFIGURATION", "Gemini weigert de ingestelde API-sleutel of modeltoegang.", 503);
  }
  if (status === 429) {
    return new GeminiImageError("PROVIDER_BUSY", "Gemini heeft tijdelijk geen capaciteit of quotum. Probeer het later opnieuw.", 503, true);
  }
  if (status >= 500) {
    return new GeminiImageError("PROVIDER_UNAVAILABLE", "Gemini is tijdelijk niet bereikbaar.", 503, true);
  }
  return new GeminiImageError("PROVIDER_REJECTED", "Gemini heeft deze beeldaanvraag geweigerd.", 422);
}

export type GeminiImageResult = {
  bytes: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  providerRequestId: string | null;
};

export async function generateGeminiProductImage(
  sourceBytes: Buffer,
  options: GeminiImageJobInput,
  productName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiImageResult> {
  const source = await normalizeSource(sourceBytes);
  let response: Response;
  try {
    response = await fetchImpl(INTERACTIONS_ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey(), "content-type": "application/json" },
      body: JSON.stringify({
        model: options.modelId,
        store: false,
        input: [
          { type: "text", text: productPrompt(productName, options) },
          { type: "image", data: source.toString("base64"), mime_type: "image/png" },
        ],
        response_format: {
          type: "image",
          mime_type: "image/png",
          aspect_ratio: options.aspectRatio,
          image_size: options.imageSize,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new GeminiImageError(
      timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
      timedOut ? "Gemini reageerde niet binnen twee minuten." : "Gemini is tijdelijk niet bereikbaar.",
      503,
      true,
    );
  }
  if (!response.ok) throw providerFailure(response.status);

  const parsed = interactionResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success || !parsed.data.output_image?.data) {
    throw new GeminiImageError("INVALID_PROVIDER_RESPONSE", "Gemini retourneerde geen geldige afbeelding.");
  }
  if (parsed.data.output_image.data.length > MAX_OUTPUT_BYTES * 2) {
    throw new GeminiImageError("OUTPUT_TOO_LARGE", "Het Gemini-resultaat is groter dan 30 MB.");
  }
  const raw = Buffer.from(parsed.data.output_image.data, "base64");
  if (raw.length === 0 || raw.length > MAX_OUTPUT_BYTES) {
    throw new GeminiImageError("INVALID_PROVIDER_RESPONSE", "Gemini retourneerde geen geldige afbeelding.");
  }

  try {
    const output = await sharp(raw, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_OUTPUT_SIDE, height: MAX_OUTPUT_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    if (!output.info.width || !output.info.height || output.data.length > MAX_OUTPUT_BYTES) throw new Error("invalid output");
    return {
      bytes: output.data,
      contentType: "image/webp",
      width: output.info.width,
      height: output.info.height,
      providerRequestId: parsed.data.id ?? response.headers.get("x-request-id"),
    };
  } catch {
    throw new GeminiImageError("INVALID_OUTPUT_IMAGE", "Het Gemini-resultaat kon niet veilig als afbeelding worden verwerkt.");
  }
}
