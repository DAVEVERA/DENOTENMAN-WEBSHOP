import "server-only";

import sharp from "sharp";
import { z } from "zod";
import { getVModelDescriptor } from "@/lib/design-studio/vmodel-models";
import type { VModelJobInput } from "@/lib/design-studio/vmodel-schema";

const TASK_STATUS_ENDPOINT = "https://api.vmodel.ai/api/tasks/v1/get";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;
const MAX_OUTPUT_SIDE = 5_000;

const createResponseSchema = z.object({
  code: z.number(),
  result: z.object({
    task_id: z.string().trim().min(1).max(200),
    task_cost: z.number().nonnegative().optional(),
  }),
});

const taskResponseSchema = z.object({
  code: z.number(),
  result: z.object({
    task_id: z.string().trim().min(1).max(200),
    status: z.enum(["starting", "processing", "succeeded", "failed", "canceled"]),
    output: z.array(z.string().url()).optional().nullable(),
    error: z.union([z.string(), z.null()]).optional(),
  }),
});

const presetInstructions: Record<VModelJobInput["preset"], string> = {
  editorial: "Create a premium editorial product photograph with warm natural materials, tactile detail and restrained styling.",
  lifestyle: "Place the product in a credible Dutch serving moment with natural daylight, human warmth and an uncluttered table setting.",
  seasonal: "Create a tasteful seasonal campaign scene with subtle ingredients and generous clean copy space, but do not render any text.",
  social: "Create a bold, immediately readable social-media composition with one clear product focal point and controlled depth.",
  hero: "Create a wide commercial hero composition with the product clearly visible and calm negative space on the left for real HTML copy.",
};

export class VModelError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "VModelError";
  }
}

function apiKey(): string {
  const value = process.env.VMODEL_API_KEY?.trim();
  if (!value) throw new VModelError("NOT_CONFIGURED", "VModel is nog niet geconfigureerd.", 503);
  return value;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${apiKey()}` };
}

function campaignPrompt(productName: string, options: VModelJobInput): string {
  const brief = options.brief ? `Creative brief: ${options.brief}` : "Creative brief: keep the scene timeless and conversion-focused.";
  return [
    `Create a commercial campaign image for De Notenman using the supplied reference image of ${productName}.`,
    "Preserve the exact product, packaging, colors, proportions and recognizable food texture from the reference.",
    presetInstructions[options.preset],
    brief,
    "Warm cream, natural wood and deep charcoal may support the existing brand, but the product remains the single focal point.",
    "No invented labels, no altered logo, no watermark, no fake UI, no floating duplicate packaging, no unsafe content and no text in the image.",
  ].join(" ");
}

async function requestJson(input: string, init: RequestInit, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new VModelError(
      timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
      timedOut ? "VModel reageerde niet binnen 20 seconden." : "VModel is tijdelijk niet bereikbaar.",
      503,
      true,
    );
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new VModelError(
      retryable ? "PROVIDER_BUSY" : "PROVIDER_REJECTED",
      retryable ? "VModel is tijdelijk bezet. Probeer het zo opnieuw." : "VModel heeft deze aanvraag geweigerd.",
      retryable ? 503 : 422,
      retryable,
    );
  }
  return response.json().catch(() => {
    throw new VModelError("INVALID_PROVIDER_RESPONSE", "VModel retourneerde geen geldig antwoord.");
  });
}

export async function createVModelTask(
  options: VModelJobInput,
  sourceUrl: string,
  productName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ providerTaskId: string; taskCost: number | null }> {
  const model = getVModelDescriptor(options.modelId);
  const input: Record<string, unknown> = {
    prompt: campaignPrompt(productName, options),
    [model.imageInputField]: [sourceUrl],
    aspect_ratio: options.aspectRatio,
    disable_safety_checker: false,
  };
  if (model.imageInputField === "img_urls") {
    input.resolution = model.qualityValues[options.quality];
    input.output_format = "jpg";
    if (model.id === "nano-banana-2") input.google_search = false;
  } else {
    input.size = model.qualityValues[options.quality];
    input.sequential_image_generation = "disabled";
  }

  const raw = await requestJson(model.createEndpoint, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ version: model.version, input }),
    cache: "no-store",
  }, fetchImpl);
  const parsed = createResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.code !== 200) {
    throw new VModelError("INVALID_PROVIDER_RESPONSE", "VModel accepteerde de aanvraag niet correct.");
  }
  return { providerTaskId: parsed.data.result.task_id, taskCost: parsed.data.result.task_cost ?? null };
}

export type VModelTaskState = {
  providerTaskId: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  outputUrls: string[];
  error: string | null;
};

export async function getVModelTask(providerTaskId: string, fetchImpl: typeof fetch = fetch): Promise<VModelTaskState> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(providerTaskId)) {
    throw new VModelError("INVALID_PROVIDER_TASK", "De VModel-taakcode is ongeldig.", 422);
  }
  const raw = await requestJson(`${TASK_STATUS_ENDPOINT}/${encodeURIComponent(providerTaskId)}`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  }, fetchImpl);
  const parsed = taskResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.code !== 200 || parsed.data.result.task_id !== providerTaskId) {
    throw new VModelError("INVALID_PROVIDER_RESPONSE", "VModel retourneerde een ongeldige taakstatus.");
  }
  return {
    providerTaskId,
    status: parsed.data.result.status,
    outputUrls: parsed.data.result.output ?? [],
    error: parsed.data.result.error?.trim() || null,
  };
}

function assertVModelOutputUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VModelError("INVALID_OUTPUT_URL", "VModel retourneerde een ongeldige bestandslocatie.");
  }
  const officialHost = url.hostname === "vmodel.ai" || url.hostname.endsWith(".vmodel.ai");
  if (url.protocol !== "https:" || !officialHost || url.username || url.password || (url.port && url.port !== "443")) {
    throw new VModelError("INVALID_OUTPUT_URL", "VModel retourneerde een niet-toegestane bestandslocatie.");
  }
  return url;
}

async function readLimitedBody(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_OUTPUT_BYTES) throw new VModelError("OUTPUT_TOO_LARGE", "Het VModel-resultaat is groter dan 30 MB.");
  if (!response.body) throw new VModelError("INVALID_PROVIDER_RESPONSE", "Het VModel-resultaat is leeg.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_OUTPUT_BYTES) {
      await reader.cancel();
      throw new VModelError("OUTPUT_TOO_LARGE", "Het VModel-resultaat is groter dan 30 MB.");
    }
    chunks.push(value);
  }
  if (total === 0) throw new VModelError("INVALID_PROVIDER_RESPONSE", "Het VModel-resultaat is leeg.");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export type VModelImageResult = {
  bytes: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
};

export async function downloadVModelImage(urlValue: string, fetchImpl: typeof fetch = fetch): Promise<VModelImageResult> {
  const url = assertVModelOutputUrl(urlValue);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: authHeaders(),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof VModelError) throw error;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new VModelError(
      timedOut ? "OUTPUT_TIMEOUT" : "OUTPUT_UNAVAILABLE",
      timedOut ? "Het VModel-resultaat kon niet op tijd worden opgehaald." : "Het VModel-resultaat kon tijdelijk niet worden opgehaald.",
      503,
      true,
    );
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new VModelError(
      retryable ? "OUTPUT_UNAVAILABLE" : "OUTPUT_REJECTED",
      retryable ? "Het VModel-resultaat is tijdelijk niet beschikbaar." : "Het VModel-resultaat kon niet worden gedownload.",
      retryable ? 503 : 502,
      retryable,
    );
  }
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new VModelError("INVALID_OUTPUT_TYPE", "VModel retourneerde geen geldige afbeelding.");
  }
  const raw = await readLimitedBody(response);
  try {
    const output = await sharp(raw, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_OUTPUT_SIDE, height: MAX_OUTPUT_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    if (!output.info.width || !output.info.height || output.data.length > MAX_OUTPUT_BYTES) throw new Error("invalid output");
    return { bytes: output.data, contentType: "image/webp", width: output.info.width, height: output.info.height };
  } catch {
    throw new VModelError("INVALID_OUTPUT_IMAGE", "Het VModel-resultaat kon niet veilig als afbeelding worden verwerkt.");
  }
}
