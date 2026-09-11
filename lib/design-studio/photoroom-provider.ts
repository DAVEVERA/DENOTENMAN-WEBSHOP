import sharp from "sharp";
import type { PhotoRoomJobInput } from "@/lib/design-studio/photoroom-schema";
import type { PhotoRoomAvailability } from "@/lib/design-studio/types";

const ENDPOINT = "https://image-api.photoroom.com/v2/edit";
const ACCOUNT_ENDPOINT = "https://image-api.photoroom.com/v2/account";
const MAX_BYTES = 30 * 1024 * 1024;
const MAX_SIDE = 5_000;
const TIMEOUT_MS = 45_000;
const ACCOUNT_TIMEOUT_MS = 8_000;

export class PhotoRoomError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = "PhotoRoomError";
  }
}

export async function getPhotoRoomAvailability(
  fetchImpl: typeof fetch = fetch,
): Promise<PhotoRoomAvailability> {
  const apiKey = process.env.PHOTOROOM_API_KEY?.trim();
  if (!apiKey) return { status: "not_configured", availableCredits: null, requiredCredits: null };

  let response: Response;
  try {
    response = await fetchImpl(ACCOUNT_ENDPOINT, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable", availableCredits: null, requiredCredits: null };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: "invalid_configuration", availableCredits: null, requiredCredits: null };
  }
  if (!response.ok) return { status: "unavailable", availableCredits: null, requiredCredits: null };

  const body = await response.json().catch(() => null) as { images?: { available?: unknown }; plan?: unknown } | null;
  const available = body?.images?.available;
  if (typeof available !== "number" || !Number.isFinite(available) || available < 0) {
    return { status: "unavailable", availableCredits: null, requiredCredits: null };
  }
  const availableCredits = Math.floor(available);
  const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : "";
  // An Image Editing call costs five Basic credits and one Plus credit.
  const requiredCredits = plan === "plus" ? 1 : 5;
  return {
    status: availableCredits >= requiredCredits ? "ready" : "insufficient_credits",
    availableCredits,
    requiredCredits,
  };
}

export async function assertPhotoRoomAvailable(fetchImpl: typeof fetch = fetch): Promise<number> {
  const availability = await getPhotoRoomAvailability(fetchImpl);
  if (availability.status === "ready") return availability.availableCredits!;
  if (availability.status === "insufficient_credits") {
    throw new PhotoRoomError("CREDITS_EXHAUSTED", "Het PhotoRoom-tegoed is onvoldoende. Vul het API-tegoed aan om een nieuw concept te maken.", 503);
  }
  if (availability.status === "not_configured") {
    throw new PhotoRoomError("NOT_CONFIGURED", "PhotoRoom is nog niet geconfigureerd.", 503);
  }
  if (availability.status === "invalid_configuration") {
    throw new PhotoRoomError("INVALID_CONFIGURATION", "De PhotoRoom API-sleutel wordt geweigerd. Controleer de configuratie.", 503);
  }
  throw new PhotoRoomError("PROVIDER_UNAVAILABLE", "De beschikbaarheid van PhotoRoom kon niet worden gecontroleerd. Probeer het later opnieuw.", 503);
}

function backgroundColor(options: PhotoRoomJobInput): string | null {
  if (options.background === "transparent") return null;
  if (options.background === "white") return "FFFFFF";
  if (options.background === "brand") return "F6F3EE";
  return options.customColor!.slice(1).toUpperCase();
}

export async function normalizePhotoRoomInput(bytes: Buffer): Promise<Buffer> {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new PhotoRoomError("INVALID_SOURCE", "De bronafbeelding is leeg of groter dan 30 MB.", 422);
  }
  try {
    const image = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("missing dimensions");
    return image
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (error) {
    if (error instanceof PhotoRoomError) throw error;
    throw new PhotoRoomError("INVALID_SOURCE", "De bronafbeelding kon niet veilig worden gelezen.", 422);
  }
}

export type PhotoRoomResult = {
  bytes: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  providerRequestId: string | null;
};

export async function runPhotoRoomEdit(
  sourceBytes: Buffer,
  options: PhotoRoomJobInput,
  fetchImpl: typeof fetch = fetch
): Promise<PhotoRoomResult> {
  const apiKey = process.env.PHOTOROOM_API_KEY?.trim();
  if (!apiKey) throw new PhotoRoomError("NOT_CONFIGURED", "PhotoRoom is nog niet geconfigureerd.", 503);

  const normalized = await normalizePhotoRoomInput(sourceBytes);
  const form = new FormData();
  form.set("imageFile", new Blob([new Uint8Array(normalized)], { type: "image/png" }), "source.png");
  form.set("removeBackground", "true");
  form.set("outputSize", options.format === "square" ? "1200x1200" : "1200x1500");
  form.set("padding", String(options.padding));
  form.set("horizontalAlignment", "center");
  form.set("verticalAlignment", "center");
  form.set("export.format", "webp");
  const color = backgroundColor(options);
  if (color) form.set("background.color", color);
  if (options.softShadow) form.set("shadow.mode", "ai.soft");

  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new PhotoRoomError(timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE", timedOut ? "PhotoRoom reageerde niet binnen 45 seconden." : "PhotoRoom is tijdelijk niet bereikbaar.", 503);
  }

  if (!response.ok) {
    if (response.status === 402) {
      throw new PhotoRoomError("CREDITS_EXHAUSTED", "Het PhotoRoom-tegoed is onvoldoende. Vul het API-tegoed aan om een nieuw concept te maken.", 503);
    }
    const retryable = response.status === 429 || response.status >= 500;
    throw new PhotoRoomError(retryable ? "PROVIDER_BUSY" : "PROVIDER_REJECTED", retryable ? "PhotoRoom is tijdelijk bezet. Probeer het later opnieuw." : "PhotoRoom heeft deze bewerking geweigerd.", retryable ? 503 : 422);
  }
  const responseType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!responseType || !["image/png", "image/jpeg", "image/webp"].includes(responseType)) {
    throw new PhotoRoomError("INVALID_PROVIDER_RESPONSE", "PhotoRoom retourneerde geen geldige afbeelding.");
  }
  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.length === 0 || raw.length > MAX_BYTES) throw new PhotoRoomError("INVALID_PROVIDER_RESPONSE", "Het PhotoRoom-resultaat heeft een ongeldige grootte.");

  try {
    const output = await sharp(raw, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    if (!output.info.width || !output.info.height || output.data.length > MAX_BYTES) throw new Error("invalid output");
    return {
      bytes: output.data,
      contentType: "image/webp",
      width: output.info.width,
      height: output.info.height,
      providerRequestId: response.headers.get("x-request-id") || response.headers.get("x-photoroom-request-id"),
    };
  } catch {
    throw new PhotoRoomError("INVALID_PROVIDER_RESPONSE", "Het PhotoRoom-resultaat kon niet veilig worden verwerkt.");
  }
}
