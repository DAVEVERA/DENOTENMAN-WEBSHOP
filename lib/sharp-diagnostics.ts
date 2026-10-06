import "server-only";

import sharp from "sharp";

// What the app's sharp can do and what it was given, for logs when an image fails to
// decode. Holds no secrets: versions, supported input formats and the first bytes.
export function sharpDiagnostics(input?: Buffer | Uint8Array | null) {
  const format = sharp.format as unknown as Record<string, { input?: { buffer?: boolean } } | undefined>;
  return {
    versions: sharp.versions,
    bufferInputs: Object.fromEntries(["jpeg", "png", "webp", "gif", "svg", "avif"].map((name) => [name, Boolean(format[name]?.input?.buffer)])),
    input: input
      ? {
          constructor: input.constructor?.name ?? null,
          isBuffer: Buffer.isBuffer(input),
          length: input.length,
          head: Buffer.from(input.subarray(0, 12)).toString("hex"),
        }
      : null,
  };
}
