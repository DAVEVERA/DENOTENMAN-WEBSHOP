// Server code only; no "server-only" marker because CLI scripts import it too.
import sharp, { type Sharp } from "sharp";

// Next's image optimizer calls sharp.block({ operation: ["VipsForeignLoad"] }) the first
// time it optimizes an image, and then unblocks a short list of loaders. libvips keeps
// that state for the whole process, so from that moment on every other sharp call in
// this server can fail with "Input buffer contains unsupported image format", even for
// plain JPEGs. App code therefore uses this wrapper, which unblocks the same raster
// loaders Next allows right before each call. SVG stays blocked except inside withSvg.

const RASTER_LOADERS = [
  "VipsForeignLoadHeif",
  "VipsForeignLoadJpeg",
  "VipsForeignLoadNsgif",
  "VipsForeignLoadPng",
  "VipsForeignLoadTiff",
  "VipsForeignLoadWebp",
];

function unblockRasterLoaders(): void {
  sharp.unblock({ operation: RASTER_LOADERS });
}

function appSharp(...args: unknown[]): Sharp {
  unblockRasterLoaders();
  return (sharp as unknown as (...input: unknown[]) => Sharp)(...args);
}

// Keep sharp's static API (format, versions, cache, concurrency, block, unblock, ...).
Object.assign(appSharp, sharp);

/**
 * Runs work that needs to read SVG (our own trusted artwork only), then blocks the SVG
 * loader again so Next's optimizer keeps refusing SVG input.
 */
export async function withSvg<T>(work: () => Promise<T>): Promise<T> {
  sharp.unblock({ operation: ["VipsForeignLoadSvg"] });
  try {
    return await work();
  } finally {
    sharp.block({ operation: ["VipsForeignLoadSvg"] });
  }
}

export default appSharp as unknown as typeof sharp;
