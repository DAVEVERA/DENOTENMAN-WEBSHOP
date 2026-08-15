import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { z } from "zod";

const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const MAX_OPENAI_RESPONSE_BYTES = 32 * 1024 * 1024;
const OPENAI_TIMEOUT_MS = 120_000;
const MAX_STUDIO_SOURCE_BYTES = 16 * 1024 * 1024;
const studioRateLimitState = new Map<string, { count: number; resetAt: number }>();
const gcs = new Storage();

type StudioErrorCode =
  | "CONFIGURATION_MISSING"
  | "STORAGE_CONFIGURATION_MISSING"
  | "VALIDATION_ERROR"
  | "INVALID_DIMENSIONS"
  | "INVALID_CROP"
  | "IMAGE_ORDER_CONFLICT"
  | "UPSTREAM_FAILED"
  | "UPSTREAM_INVALID_RESPONSE"
  | "STORAGE_FAILED"
  | "NOT_FOUND"
  | "LAST_IMAGE"
  | "CREDITS_EXHAUSTED"
  | "RATE_LIMITED";

export class ProductImageStudioError extends Error {
  constructor(
    readonly code: StudioErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ProductImageStudioError";
  }
}

export class ConfigurationMissingError extends ProductImageStudioError {
  constructor() {
    super(
      "CONFIGURATION_MISSING",
      "OPENAI_API_KEY is niet geconfigureerd voor AI-beeldbewerkingen.",
      503
    );
    this.name = "ConfigurationMissingError";
  }
}

export class StudioValidationError extends ProductImageStudioError {
  constructor(code: "VALIDATION_ERROR" | "INVALID_DIMENSIONS" | "INVALID_CROP", message: string) {
    super(code, message, 400);
    this.name = "StudioValidationError";
  }
}

export class StudioConflictError extends ProductImageStudioError {
  constructor(message = "De afbeeldingsvolgorde is intussen gewijzigd. Herlaad en probeer opnieuw.") {
    super("IMAGE_ORDER_CONFLICT", message, 409);
    this.name = "StudioConflictError";
  }
}

const imageId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const prompt = z.string().trim().min(3).max(2_000);
const quality = z.enum(["low", "medium", "high"]);
const dimension = z.number().int().min(16).max(3_840);
const coordinate = z.number().int().min(0).max(3_840);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const studioRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("generate"), prompt, width: dimension, height: dimension, quality }).strict(),
  z.object({ operation: z.literal("edit"), sourceImageId: imageId, prompt, width: dimension, height: dimension, quality }).strict(),
  z.object({ operation: z.literal("spread"), sourceImageId: imageId, prompt, width: dimension, height: dimension, quality }).strict(),
  z.object({ operation: z.literal("extend"), sourceImageId: imageId, prompt, width: dimension, height: dimension, quality, anchor: z.enum(["center", "top", "bottom", "left", "right"]).default("center") }).strict(),
  z.object({ operation: z.literal("fill"), sourceImageId: imageId, prompt, x: coordinate, y: coordinate, width: dimension, height: dimension, quality }).strict(),
  z.object({ operation: z.literal("crop"), sourceImageId: imageId, x: coordinate, y: coordinate, width: dimension, height: dimension }).strict(),
  z.object({ operation: z.literal("resize"), sourceImageId: imageId, width: dimension, height: dimension, fit: z.enum(["contain", "cover", "fill", "inside", "outside"]).default("contain") }).strict(),
  z.object({ operation: z.literal("text_label"), sourceImageId: imageId, text: z.string().trim().min(1).max(80), x: coordinate, y: coordinate, fontSize: z.number().int().min(8).max(256), color, backgroundColor: color.optional() }).strict(),
  z.object({ operation: z.literal("icon"), sourceImageId: imageId, icon: z.enum(["leaf", "star", "badge", "nut"]), x: coordinate, y: coordinate, size: z.number().int().min(16).max(512), color }).strict(),
  z.object({ operation: z.literal("remove_background"), sourceImageId: imageId, tolerance: z.number().int().min(0).max(120).default(24) }).strict(),
  z.object({ operation: z.literal("cutout"), sourceImageId: imageId, tolerance: z.number().int().min(0).max(120).default(24) }).strict(),
]);

export type StudioRequest = z.infer<typeof studioRequestSchema>;
type AIStudioRequest = Extract<StudioRequest, { operation: "generate" | "edit" | "spread" | "extend" }>;
type AIEditStudioRequest = Extract<StudioRequest, { operation: "edit" | "spread" | "extend" | "fill" }>;
type DeterministicStudioRequest = Extract<StudioRequest, { operation: "crop" | "resize" | "text_label" | "icon" | "remove_background" | "cutout" }>;

export function buildStudioVersionKey(
  productSlug: string,
  operation: StudioRequest["operation"],
  sourceImageId?: string
): string {
  const slug = productSlug
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    throw new StudioValidationError("VALIDATION_ERROR", "De productslug is niet geschikt voor beeldopslag.");
  }
  const versionSource = sourceImageId ?? "generated";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(versionSource)) {
    throw new StudioValidationError("VALIDATION_ERROR", "De bronafbeelding heeft een ongeldige identificatie.");
  }
  return `products/${slug}/versions/${versionSource}/${operation}-${randomUUID()}.png`;
}

function assertGPTImageDimensions(width: number, height: number): void {
  const pixels = width * height;
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (
    width % 16 !== 0 ||
    height % 16 !== 0 ||
    pixels < 655_360 ||
    pixels > 8_294_400 ||
    ratio > 3
  ) {
    throw new StudioValidationError(
      "INVALID_DIMENSIONS",
      "GPT Image 2 vereist zijden in veelvouden van 16, maximaal 3840 px, een verhouding tot 3:1 en 655.360 tot 8.294.400 pixels."
    );
  }
}

export function parseStudioRequest(input: unknown): StudioRequest {
  const parsed = studioRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new StudioValidationError("VALIDATION_ERROR", "Ongeldige beeldstudioparameters.");
  }
  if (parsed.data.operation === "generate" || parsed.data.operation === "edit" || parsed.data.operation === "spread" || parsed.data.operation === "extend") {
    assertGPTImageDimensions(parsed.data.width, parsed.data.height);
  }
  return parsed.data;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type GenerateInput = Pick<AIStudioRequest, "prompt" | "width" | "height" | "quality">;
type EditInput = GenerateInput & { image: Buffer; mask?: Buffer };
type OpenAIImageResult = { bytes: Buffer; requestId: string | null };

export type OpenAIImageGateway = {
  generate(input: GenerateInput): Promise<OpenAIImageResult>;
  edit(input: EditInput): Promise<OpenAIImageResult>;
};

function requireApiKey(apiKey: string | undefined): string {
  const normalized = apiKey?.trim();
  if (!normalized) throw new ConfigurationMissingError();
  return normalized;
}

async function decodeOpenAIImageResponse(response: Response): Promise<OpenAIImageResult> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_OPENAI_RESPONSE_BYTES) {
    throw new ProductImageStudioError("UPSTREAM_INVALID_RESPONSE", "OpenAI retourneerde een te grote afbeelding.", 502);
  }

  const body = await response.json().catch(() => null) as {
    data?: Array<{ b64_json?: unknown }>;
    error?: { message?: unknown; code?: unknown };
  } | null;
  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    const upstreamCode = typeof body?.error?.code === "string" ? body.error.code : undefined;
    console.error("OpenAI image request failed", {
      status: response.status,
      requestId,
      upstreamCode,
    });
    if (upstreamCode === "credit_balance_exhausted") {
      throw new ProductImageStudioError(
        "CREDITS_EXHAUSTED",
        "Het OpenAI-project heeft geen API-tegoed. Voeg tegoed toe of koppel een projectsleutel met beschikbaar budget.",
        402
      );
    }
    throw new ProductImageStudioError(
      response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_FAILED",
      response.status === 429 ? "De beeldgenerator is tijdelijk te druk. Probeer later opnieuw." : "De AI-beeldbewerking is niet gelukt.",
      response.status === 429 ? 429 : 502
    );
  }

  const encoded = body?.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > MAX_OPENAI_RESPONSE_BYTES * 2) {
    throw new ProductImageStudioError("UPSTREAM_INVALID_RESPONSE", "OpenAI retourneerde geen geldige afbeelding.", 502);
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > MAX_OPENAI_RESPONSE_BYTES) {
    throw new ProductImageStudioError("UPSTREAM_INVALID_RESPONSE", "OpenAI retourneerde geen geldige afbeelding.", 502);
  }
  return { bytes, requestId };
}

async function fetchWithTimeout(fetchImpl: FetchLike, input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProductImageStudioError("UPSTREAM_FAILED", "De AI-beeldbewerking duurde te lang.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOpenAIImageGateway({
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = fetch,
}: {
  apiKey?: string;
  fetchImpl?: FetchLike;
} = {}): OpenAIImageGateway {
  return {
    async generate(input) {
      assertGPTImageDimensions(input.width, input.height);
      const key = requireApiKey(apiKey);
      const response = await fetchWithTimeout(fetchImpl, `${OPENAI_BASE_URL}/images/generations`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: OPENAI_IMAGE_MODEL,
          prompt: input.prompt,
          size: `${input.width}x${input.height}`,
          quality: input.quality,
          output_format: "png",
          background: "opaque",
          n: 1,
        }),
      });
      return decodeOpenAIImageResponse(response);
    },

    async edit(input) {
      assertGPTImageDimensions(input.width, input.height);
      const key = requireApiKey(apiKey);
      const form = new FormData();
      form.set("model", OPENAI_IMAGE_MODEL);
      form.set("prompt", input.prompt);
      form.set("size", `${input.width}x${input.height}`);
      form.set("quality", input.quality);
      form.set("output_format", "png");
      form.set("background", "opaque");
      form.set("n", "1");
      form.set("image", new File([Uint8Array.from(input.image)], "source.png", { type: "image/png" }));
      if (input.mask) form.set("mask", new File([Uint8Array.from(input.mask)], "mask.png", { type: "image/png" }));
      const response = await fetchWithTimeout(fetchImpl, `${OPENAI_BASE_URL}/images/edits`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}` },
        body: form,
      });
      return decodeOpenAIImageResponse(response);
    },
  };
}

export type ImageOrderRow = { id: string; sortOrder: number; isPrimary: boolean };

export function planCanonicalImageOrder({
  current,
  expectedImageIds,
  orderedImageIds,
  primaryImageId,
}: {
  current: ImageOrderRow[];
  expectedImageIds: string[];
  orderedImageIds: string[];
  primaryImageId?: string;
}): ImageOrderRow[] {
  const canonicalCurrent = [...current]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((image) => image.id);
  if (
    canonicalCurrent.length !== expectedImageIds.length ||
    canonicalCurrent.some((id, index) => id !== expectedImageIds[index])
  ) {
    throw new StudioConflictError();
  }
  if (
    orderedImageIds.length !== canonicalCurrent.length ||
    new Set(orderedImageIds).size !== orderedImageIds.length ||
    orderedImageIds.some((id) => !canonicalCurrent.includes(id))
  ) {
    throw new StudioValidationError("VALIDATION_ERROR", "De nieuwe volgorde moet iedere actieve afbeelding exact één keer bevatten.");
  }
  const primary = primaryImageId ?? orderedImageIds[0];
  if (!primary || !orderedImageIds.includes(primary)) {
    throw new StudioValidationError("VALIDATION_ERROR", "Kies een primaire afbeelding uit de actieve afbeeldingsset.");
  }
  return orderedImageIds.map((id, sortOrder) => ({ id, sortOrder, isPrimary: id === primary }));
}

export function planImageDeletion(current: ImageOrderRow[], imageIdToDelete: string): ImageOrderRow[] {
  const ordered = [...current].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
  );
  if (!ordered.some((image) => image.id === imageIdToDelete)) {
    throw new ProductImageStudioError("NOT_FOUND", "De productafbeelding bestaat niet.", 404);
  }
  if (ordered.length === 1) {
    throw new ProductImageStudioError(
      "LAST_IMAGE",
      "De laatste productafbeelding kan niet worden verwijderd. Voeg eerst een vervanger toe.",
      409
    );
  }

  const remaining = ordered.filter((image) => image.id !== imageIdToDelete);
  const retainedPrimary = remaining.find((image) => image.isPrimary)?.id ?? remaining[0]?.id;
  return remaining.map((image, sortOrder) => ({
    id: image.id,
    sortOrder,
    isPrimary: image.id === retainedPrimary,
  }));
}

export async function prepareAIStudioEdit(
  request: AIEditStudioRequest,
  source: Buffer
): Promise<{
  image: Buffer;
  mask?: Buffer;
  prompt: string;
  width: number;
  height: number;
  quality: "low" | "medium" | "high";
}> {
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 16_000_000) {
    throw new StudioValidationError("VALIDATION_ERROR", "De bronafbeelding heeft ongeldige of te grote afmetingen.");
  }

  if (request.operation === "edit" || request.operation === "spread") {
    return {
      image: await sharp(source).ensureAlpha().png().toBuffer(),
      prompt: request.prompt,
      width: request.width,
      height: request.height,
      quality: request.quality,
    };
  }

  if (request.operation === "extend") {
    if (request.width < metadata.width || request.height < metadata.height) {
      throw new StudioValidationError("INVALID_DIMENSIONS", "Extend-afmetingen mogen niet kleiner zijn dan de bronafbeelding.");
    }
    const horizontalCenter = Math.floor((request.width - metadata.width) / 2);
    const verticalCenter = Math.floor((request.height - metadata.height) / 2);
    const left = request.anchor === "left" ? 0 : request.anchor === "right" ? request.width - metadata.width : horizontalCenter;
    const top = request.anchor === "top" ? 0 : request.anchor === "bottom" ? request.height - metadata.height : verticalCenter;
    const normalizedSource = await sharp(source).ensureAlpha().png().toBuffer();
    const image = await sharp({
      create: { width: request.width, height: request.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    }).composite([{ input: normalizedSource, left, top }]).png().toBuffer();
    const protectedArea = await sharp({
      create: { width: metadata.width, height: metadata.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).png().toBuffer();
    const mask = await sharp({
      create: { width: request.width, height: request.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: protectedArea, left, top }]).png().toBuffer();
    return { image, mask, prompt: request.prompt, width: request.width, height: request.height, quality: request.quality };
  }

  if (request.x + request.width > metadata.width || request.y + request.height > metadata.height) {
    throw new StudioValidationError("INVALID_CROP", "Het fill-gebied valt buiten de bronafbeelding.");
  }
  assertGPTImageDimensions(metadata.width, metadata.height);
  const maskPixels = Buffer.alloc(metadata.width * metadata.height * 4, 255);
  for (let y = request.y; y < request.y + request.height; y += 1) {
    for (let x = request.x; x < request.x + request.width; x += 1) {
      maskPixels[(y * metadata.width + x) * 4 + 3] = 0;
    }
  }
  const mask = await sharp(maskPixels, { raw: { width: metadata.width, height: metadata.height, channels: 4 } }).png().toBuffer();
  return {
    image: await sharp(source).ensureAlpha().png().toBuffer(),
    mask,
    prompt: request.prompt,
    width: metadata.width,
    height: metadata.height,
    quality: request.quality,
  };
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const iconPaths: Record<Extract<StudioRequest, { operation: "icon" }>["icon"], string> = {
  leaf: "M24 4C13 4 5 11 5 22c0 7 5 12 12 12 11 0 18-12 19-29-5 4-8 4-12-1Zm-9 24c4-7 9-12 16-16-5 5-9 11-12 18l-4-2Z",
  star: "M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1 5-11Z",
  badge: "M20 3l5 4 6-1 2 6 5 3-2 6 2 6-5 3-2 6-6-1-5 4-5-4-6 1-2-6-5-3 2-6-2-6 5-3 2-6 6 1 5-4Z",
  nut: "M20 4C10 4 4 12 4 22s7 16 16 16 16-7 16-16S30 4 20 4Zm0 8c5 0 8 4 8 9 0 6-4 9-8 9s-8-3-8-9c0-5 3-9 8-9Z",
};

async function removeConnectedBackground(source: Buffer, tolerance: number): Promise<Buffer> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new StudioValidationError("VALIDATION_ERROR", "De afbeelding kon niet naar RGBA worden geconverteerd.");
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  const target = corners.reduce(
    (sum, index) => {
      const offset = index * 4;
      return [sum[0] + data[offset], sum[1] + data[offset + 1], sum[2] + data[offset + 2]] as [number, number, number];
    },
    [0, 0, 0] as [number, number, number]
  ).map((value) => value / corners.length);
  const thresholdSquared = tolerance * tolerance * 3;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (index: number) => {
    if (!visited[index]) {
      visited[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const offset = index * 4;
    const red = data[offset] - target[0];
    const green = data[offset + 1] - target[1];
    const blue = data[offset + 2] - target[2];
    if (red * red + green * green + blue * blue > thresholdSquared) continue;
    data[offset + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export async function runDeterministicStudioOperation(
  request: DeterministicStudioRequest,
  source: Buffer
): Promise<{ bytes: Buffer; contentType: "image/png"; extension: "png" }> {
  let bytes: Buffer;
  if (request.operation === "crop") {
    const metadata = await sharp(source).metadata();
    if (!metadata.width || !metadata.height || request.x + request.width > metadata.width || request.y + request.height > metadata.height) {
      throw new StudioValidationError("INVALID_CROP", "De uitsnede valt buiten de bronafbeelding.");
    }
    bytes = await sharp(source).extract({ left: request.x, top: request.y, width: request.width, height: request.height }).png().toBuffer();
  } else if (request.operation === "resize") {
    bytes = await sharp(source).resize({ width: request.width, height: request.height, fit: request.fit, background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  } else if (request.operation === "remove_background") {
    bytes = await removeConnectedBackground(source, request.tolerance);
  } else if (request.operation === "cutout") {
    const transparent = await removeConnectedBackground(source, request.tolerance);
    bytes = await sharp(transparent)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } else if (request.operation === "text_label") {
    const estimatedWidth = Math.max(request.fontSize * 2, Math.ceil(request.text.length * request.fontSize * 0.65));
    const height = Math.ceil(request.fontSize * 1.5);
    const background = request.backgroundColor ? `<rect width="${estimatedWidth}" height="${height}" rx="${Math.max(4, Math.round(request.fontSize / 5))}" fill="${request.backgroundColor}"/>` : "";
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${estimatedWidth}" height="${height}">${background}<text x="${Math.round(request.fontSize / 4)}" y="${Math.round(request.fontSize * 1.05)}" font-family="Arial, sans-serif" font-size="${request.fontSize}" font-weight="700" fill="${request.color}">${escapeSvgText(request.text)}</text></svg>`);
    bytes = await sharp(source).composite([{ input: overlay, left: request.x, top: request.y }]).png().toBuffer();
  } else {
    const path = iconPaths[request.icon];
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${request.size}" height="${request.size}"><path d="${path}" fill="${request.color}"/></svg>`);
    bytes = await sharp(source).composite([{ input: overlay, left: request.x, top: request.y }]).png().toBuffer();
  }
  return { bytes, contentType: "image/png", extension: "png" };
}

export function consumeStudioRateLimit(
  key: string,
  now = Date.now(),
  state: Map<string, { count: number; resetAt: number }> = studioRateLimitState
): void {
  const current = state.get(key);
  if (!current || now >= current.resetAt) {
    state.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 5) {
    throw new ProductImageStudioError("RATE_LIMITED", "Maximaal vijf beeldstudiobewerkingen per minuut.", 429);
  }
  current.count += 1;
}

function configuredBucket() {
  const name = process.env.GCS_BUCKET?.trim();
  if (!name) {
    throw new ProductImageStudioError(
      "STORAGE_CONFIGURATION_MISSING",
      "GCS_BUCKET is niet geconfigureerd voor productafbeeldingen.",
      503
    );
  }
  return gcs.bucket(name);
}

export async function loadProductImageBytes(storageKey: string): Promise<Buffer> {
  try {
    const file = configuredBucket().file(storageKey);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_STUDIO_SOURCE_BYTES) {
      throw new StudioValidationError("VALIDATION_ERROR", "De bronafbeelding is leeg of groter dan 16 MB.");
    }
    const [bytes] = await file.download();
    await validateStudioImage(bytes);
    return bytes;
  } catch (error) {
    if (error instanceof ProductImageStudioError) throw error;
    const statusCode = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : 0;
    if (statusCode === 404) {
      throw new ProductImageStudioError("NOT_FOUND", "Het bronbestand ontbreekt in de beeldopslag.", 404);
    }
    console.error("Failed to load product image from storage", { storageKey, error });
    throw new ProductImageStudioError("STORAGE_FAILED", "De bronafbeelding kon niet uit de opslag worden geladen.", 502);
  }
}

export async function validateStudioImage(bytes: Buffer): Promise<{ width: number; height: number }> {
  if (bytes.length <= 0 || bytes.length > MAX_STUDIO_SOURCE_BYTES) {
    throw new StudioValidationError("VALIDATION_ERROR", "De afbeelding is leeg of groter dan 16 MB.");
  }
  const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 16_000_000 }).metadata().catch(() => null);
  const allowedFormats = new Set(["jpeg", "png", "webp", "avif"]);
  if (
    !metadata?.width ||
    !metadata.height ||
    !metadata.format ||
    !allowedFormats.has(metadata.format) ||
    metadata.width * metadata.height > 16_000_000
  ) {
    throw new StudioValidationError("VALIDATION_ERROR", "De afbeelding kan niet veilig worden verwerkt.");
  }
  return { width: metadata.width, height: metadata.height };
}

export type ArchivedProductImage = { sourceKey: string; archiveKey: string };

export function buildRestoredImageKey(originalStorageKey: string): string {
  const parts = originalStorageKey.split("/");
  const filename = parts.pop();
  const directory = parts.join("/");
  if (
    !filename ||
    !directory.startsWith("products/") ||
    originalStorageKey.includes("..") ||
    !/^[A-Za-z0-9._-]+$/.test(filename)
  ) {
    throw new StudioValidationError("VALIDATION_ERROR", "De afbeelding heeft een ongeldige opslaglocatie.");
  }
  return `${directory}/restored-${randomUUID()}-${filename}`;
}

export async function archiveProductImage(storageKey: string): Promise<ArchivedProductImage> {
  const bucket = configuredBucket();
  const safeName = storageKey.split("/").pop()?.replace(/[^A-Za-z0-9._-]/g, "-") || "image";
  const archiveKey = `trash/product-images/${Date.now()}-${randomUUID()}-${safeName}`;
  const source = bucket.file(storageKey);
  const archive = bucket.file(archiveKey);
  try {
    await source.copy(archive);
    return { sourceKey: storageKey, archiveKey };
  } catch (error) {
    await archive.delete({ ignoreNotFound: true }).catch(() => undefined);
    console.error("Failed to archive product image", { storageKey, error });
    throw new ProductImageStudioError("STORAGE_FAILED", "De afbeelding kon niet veilig naar de prullenbak worden verplaatst.", 502);
  }
}

export async function restoreArchivedProductImage(archiveKey: string, activeStorageKey: string): Promise<void> {
  const bucket = configuredBucket();
  try {
    await bucket.file(archiveKey).copy(bucket.file(activeStorageKey));
  } catch (error) {
    await bucket.file(activeStorageKey).delete({ ignoreNotFound: true }).catch(() => undefined);
    console.error("Failed to restore product image archive", { archiveKey, activeStorageKey, error });
    throw new ProductImageStudioError("STORAGE_FAILED", "De afbeelding kon niet uit de prullenbak worden hersteld.", 502);
  }
}

export async function discardArchivedProductImage(archived: ArchivedProductImage): Promise<void> {
  const bucket = configuredBucket();
  try {
    await bucket.file(archived.archiveKey).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error("Failed to discard archived product image after database rollback", { archived, error });
  }
}

export async function finalizeArchivedProductImage(archived: ArchivedProductImage): Promise<boolean> {
  const source = configuredBucket().file(archived.sourceKey);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await source.delete({ ignoreNotFound: true });
      return true;
    } catch (error) {
      console.error("Failed to remove archived product image source", { archived, attempt, error });
    }
  }
  return false;
}

export function toStudioErrorResponse(error: unknown): {
  status: number;
  body: { error: string; message: string };
} {
  if (error instanceof ProductImageStudioError) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
    return {
      status: 409,
      body: {
        error: "IMAGE_ORDER_CONFLICT",
        message: "De afbeeldingen zijn gelijktijdig gewijzigd. Herlaad en probeer opnieuw.",
      },
    };
  }
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "De beeldbewerking is niet gelukt." } };
}
