/**
 * fix-missing-images.js
 * Finds ProductImage records that return 400/0 from Supabase CDN,
 * looks for matching local files in Database/, uploads them, and fixes the DB URL.
 */

const path = require("path");
const fs = require("fs");
const https = require("https");

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
const DATABASE_DIR = path.join(__dirname, "..", "Database");

const storageUrl = `${SUPABASE_URL}/storage/v1`;
const storage = new StorageClient(storageUrl, {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
});

// --- helpers ---

async function checkStatus(url) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: "HEAD", timeout: 6000 }, (res) =>
        resolve(res.statusCode),
      );
      req.on("error", () => resolve(0));
      req.on("timeout", () => {
        req.destroy();
        resolve(0);
      });
      req.end();
    } catch {
      resolve(0);
    }
  });
}

/** Walk a directory recursively and return all file paths */
function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, results);
    else results.push(full);
  }
  return results;
}

/** Build a lookup map: normalized base name → full local path */
function buildLocalIndex() {
  const files = walkDir(DATABASE_DIR);
  const map = new Map();
  for (const f of files) {
    const base = path.basename(f).toLowerCase().trim();
    map.set(base, f);
  }
  return map;
}

/** Extract the file name from a Supabase storage URL */
function fileNameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

async function upload(localPath, fileName) {
  const data = fs.readFileSync(localPath);
  const mime = fileName.match(/\.png$/i)
    ? "image/png"
    : fileName.match(/\.gif$/i)
      ? "image/gif"
      : fileName.match(/\.webp$/i)
        ? "image/webp"
        : "image/jpeg";

  const { error } = await storage
    .from(BUCKET)
    .upload(fileName, data, { contentType: mime, upsert: true });

  if (error) throw new Error(error.message);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`;
}

// --- main ---

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  console.log("✓ DB verbonden\n");

  // Fetch all image records
  const { rows: images } = await db.query(`SELECT id, url, "productId" FROM "ProductImage"`);
  console.log(`📋 ${images.length} afbeeldingen in DB\n`);

  // Build local file index
  const localIndex = buildLocalIndex();
  console.log(`📂 ${localIndex.size} lokale bestanden gevonden\n`);

  const broken = [];

  // Check which URLs return non-200
  console.log("🔍 CDN URLs controleren (dit duurt even)...");
  let checked = 0;
  for (const img of images) {
    const status = await checkStatus(img.url);
    if (status !== 200) broken.push({ ...img, status });
    checked++;
    if (checked % 50 === 0)
      process.stdout.write(`   ${checked}/${images.length} gecontroleerd...\r`);
  }
  console.log(`\n\n❌ ${broken.length} afbeeldingen laden niet (non-200)\n`);

  if (broken.length === 0) {
    console.log("🎉 Alles is in orde!");
    await db.end();
    return;
  }

  let fixed = 0,
    skipped = 0,
    noLocal = 0;

  for (const img of broken) {
    const fileName = fileNameFromUrl(img.url);
    if (!fileName) {
      skipped++;
      continue;
    }

    const key = fileName.toLowerCase().trim();
    const localPath = localIndex.get(key);

    if (!localPath) {
      console.log(`⚠️  Geen lokaal bestand: ${fileName}`);
      noLocal++;
      continue;
    }

    try {
      const newUrl = await upload(localPath, fileName);
      await db.query(`UPDATE "ProductImage" SET url = $1 WHERE id = $2`, [newUrl, img.id]);
      console.log(`✅ Gefixt: ${fileName}`);
      fixed++;
    } catch (e) {
      console.log(`❌ Upload mislukt (${fileName}): ${e.message}`);
      skipped++;
    }
  }

  await db.end();

  console.log(`\n────────────────────────────`);
  console.log(`✅ Gefixt         : ${fixed}`);
  console.log(`⚠️  Geen lokaal    : ${noLocal}`);
  console.log(`❌ Overgeslagen   : ${skipped}`);
  console.log(`────────────────────────────`);

  if (noLocal > 0) {
    console.log(`\n⚠️  ${noLocal} producten missen ook lokaal een afbeelding.`);
    console.log(`   Voeg deze handmatig toe aan de Database/ map en run dit script opnieuw.`);
  }
}

main().catch((e) => {
  console.error("\n❌ FOUT:", e.message, "\n", e.stack);
  process.exit(1);
});
