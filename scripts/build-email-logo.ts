/**
 * Renders the brand wordmark to the PNG the review mail uses.
 *
 * Mail clients matter here: Gmail and Outlook block SVG images, so the mail
 * cannot point at public/brand/logo-wordmark.svg. The result is committed, so a
 * deploy never depends on running this.
 *
 * Run with: npx tsx scripts/build-email-logo.ts
 */
import { stat } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/brand/logo-wordmark.svg";
const TARGET = "public/brand/logo-wordmark-email.png";

/** Twice the 32px the mail template renders it at, for high-density screens. */
const HEIGHT = 64;

async function main(): Promise<void> {
  const info = await sharp(SOURCE, { density: 300 })
    .resize({ height: HEIGHT })
    .png({ compressionLevel: 9 })
    .toFile(TARGET);
  const written = await stat(TARGET);
  console.log(`${TARGET}: ${info.width}x${info.height}, ${written.size} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
