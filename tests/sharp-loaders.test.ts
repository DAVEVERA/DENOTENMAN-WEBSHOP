import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import rawSharp from "sharp";

import sharp, { withSvg } from "../lib/sharp";

// Mimics Next's image optimizer, which blocks every libvips loader for the whole process
// and unblocks a few (next/dist/server/image-optimizer.js getSharp).
function blockLikeNext() {
  rawSharp.block({ operation: ["VipsForeignLoad"] });
  rawSharp.unblock({ operation: ["VipsForeignLoadHeif", "VipsForeignLoadJpeg", "VipsForeignLoadNsgif", "VipsForeignLoadPng", "VipsForeignLoadTiff", "VipsForeignLoadWebp"] });
}

test("after Next blocks loaders, app sharp still reads raster images and SVG only inside withSvg", async (t) => {
  t.after(() => rawSharp.unblock({ operation: ["VipsForeignLoad"] }));
  const jpeg = await rawSharp({ create: { width: 8, height: 8, channels: 3, background: "#e0b200" } }).jpeg().toBuffer();
  const svg = await readFile("public/brand/logo-wordmark.svg");
  blockLikeNext();
  rawSharp.block({ operation: ["VipsForeignLoadJpeg"] }); // even when JPEG ended up blocked

  assert.equal((await sharp(jpeg).metadata()).format, "jpeg", "the wrapper unblocks raster loaders");
  await assert.rejects(sharp(svg).png().toBuffer(), /unsupported image format/u, "SVG stays blocked outside withSvg");
  const png = await withSvg(() => sharp(svg, { density: 72 }).png().toBuffer());
  assert.equal((await rawSharp(png).metadata()).format, "png");
  await assert.rejects(rawSharp(svg).png().toBuffer(), /unsupported image format/u, "withSvg blocks SVG again afterwards");
  assert.ok(sharp.versions.vips, "static API is kept");
});
