/**
 * download-and-upload-wp-images.js
 *
 * Voor ProductImage-records die een 400 geven op Supabase CDN én
 * geen lokaal bestand hebben: probeer de originele WordPress-URL
 * te downloaden en dan naar Supabase te uploaden.
 *
 * Vereiste: de originele WordPress-URL moet ergens in de Product-omschrijving
 * of in een fallback-URL kolom staan. Hier gebruiken we de bestandsnaam
 * om te zoeken in de WordPress-map die mogelijk al gedownload is.
 */

const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "dotenv@16.6.1", "node_modules", "dotenv"),
).config({ path: path.join(__dirname, "..", ".env") });

const { Client } = require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "pg@8.20.0", "node_modules", "pg"),
);
const { StorageClient } = require(
  path.join(
    __dirname,
    "..",
    "node_modules",
    ".pnpm",
    "@supabase+storage-js@2.105.4",
    "node_modules",
    "@supabase",
    "storage-js",
  ),
);

const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "product-images";
const WP_BASE = "https://denotenman.com/wp-content/uploads";

const storage = new StorageClient(`${SUPABASE_URL}/storage/v1`, {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
});

// Download a URL to a Buffer
function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return downloadUrl(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

function mimeFor(name) {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "image/jpeg";
}

function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop());
  } catch {
    return null;
  }
}

async function checkStatus(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: "HEAD", timeout: 5000 }, (r) => resolve(r.statusCode));
    req.on("error", () => resolve(0));
    req.on("timeout", () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

// Common WordPress upload year/month folders to try
const WP_PATHS = [
  "2025/12",
  "2025/11",
  "2025/10",
  "2025/09",
  "2025/08",
  "2025/07",
  "2025/06",
  "2025/05",
  "2025/04",
  "2025/03",
  "2025/02",
  "2025/01",
  "2024/12",
  "2024/11",
  "2024/10",
  "2024/09",
  "2024/08",
  "2024/07",
  "2024/06",
  "2024/05",
  "2024/04",
  "2024/03",
  "2024/02",
  "2024/01",
  "2023/12",
  "2023/11",
  "2023/10",
  "2023/09",
  "2023/08",
  "2023/07",
  "2023/06",
  "2023/05",
  "2023/04",
  "2023/03",
  "2023/02",
  "2023/01",
  "2022/12",
  "2022/06",
  "2022/01",
  "2021/10",
  "2021/07",
];

async function findOnWordPress(fileName) {
  for (const p of WP_PATHS) {
    const url = `${WP_BASE}/${p}/${encodeURIComponent(fileName)}`;
    try {
      const buf = await downloadUrl(url);
      if (buf.length > 1000) return { url, buf };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  console.log("✓ DB verbonden\n");

  const { rows: images } = await db.query(`SELECT id, url FROM "ProductImage"`);
  console.log(`📋 ${images.length} totaal — CDN controleren...\n`);

  const broken = [];
  let checked = 0;
  for (const img of images) {
    const s = await checkStatus(img.url);
    if (s !== 200) broken.push(img);
    checked++;
    if (checked % 50 === 0) process.stdout.write(`  ${checked}/${images.length} gecontroleerd\r`);
  }
  console.log(`\n❌ ${broken.length} niet beschikbaar\n`);

  if (broken.length === 0) {
    console.log("🎉 Alles OK!");
    await db.end();
    return;
  }

  let fixed = 0,
    failed = 0;

  for (const img of broken) {
    const fileName = fileNameFromUrl(img.url);
    if (!fileName) {
      failed++;
      continue;
    }

    console.log(`🔍 Zoeken: ${fileName}`);
    const result = await findOnWordPress(fileName);

    if (!result) {
      console.log(`   ⚠️  Niet gevonden op WordPress`);
      failed++;
      continue;
    }

    try {
      const { error } = await storage.from(BUCKET).upload(fileName, result.buf, {
        contentType: mimeFor(fileName),
        upsert: true,
      });
      if (error) throw new Error(error.message);

      const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`;
      await db.query(`UPDATE "ProductImage" SET url = $1 WHERE id = $2`, [newUrl, img.id]);
      console.log(`   ✅ Geüpload & DB bijgewerkt`);
      fixed++;
    } catch (e) {
      console.log(`   ❌ Mislukt: ${e.message}`);
      failed++;
    }
  }

  await db.end();
  console.log(`\n────────────────────────────`);
  console.log(`✅ Gefixt  : ${fixed}`);
  console.log(`❌ Mislukt : ${failed}`);
  console.log(`────────────────────────────`);
}

main().catch((e) => {
  console.error("\n❌ FOUT:", e.message);
  process.exit(1);
});
