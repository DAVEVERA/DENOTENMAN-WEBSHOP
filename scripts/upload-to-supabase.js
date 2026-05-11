/**
 * upload-to-supabase.js — v2
 * Werkt in pnpm monorepo zonder Prisma-path issues.
 * Gebruikt:
 *   - Supabase REST API voor storage
 *   - pg (PostgreSQL driver) direct voor DB updates
 *
 * Run: node scripts/upload-to-supabase.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const BUCKET_NAME = "product-images";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("\n❌ SUPABASE_URL en/of SUPABASE_SERVICE_KEY ontbreken in .env\n");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("\n❌ DATABASE_URL ontbreekt in .env\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const ROOT = path.resolve(__dirname, "..");
const DB_DIR = path.join(ROOT, "Database");
const PUBLIC_DIR = path.join(ROOT, "apps", "storefront", "public", "products");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return (
    { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[
      ext
    ] ?? "image/jpeg"
  );
}

function scanImages() {
  const seen = new Set();
  const results = [];

  function add(fullPath) {
    const name = path.basename(fullPath);
    if (!seen.has(name) && /\.(jpg|jpeg|png|webp)$/i.test(name)) {
      seen.add(name);
      results.push({ name, fullPath });
    }
  }

  // 1. Local public/products/
  if (fs.existsSync(PUBLIC_DIR)) {
    for (const f of fs.readdirSync(PUBLIC_DIR)) {
      add(path.join(PUBLIC_DIR, f));
    }
  }

  // 2. Database directory (recursive)
  function recurse(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile()) add(full);
    }
  }
  if (fs.existsSync(DB_DIR)) recurse(DB_DIR);

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n☁️  Supabase Storage uploader — De Notenman");
  console.log("============================================");
  console.log(`Project : ${SUPABASE_URL}`);
  console.log(`Bucket  : ${BUCKET_NAME}\n`);

  // 1. Bucket aanmaken (publiek)
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("❌ Supabase verbinding mislukt:", listErr.message);
    process.exit(1);
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (error) {
      console.error("❌ Bucket aanmaken mislukt:", error.message);
      process.exit(1);
    }
    console.log(`✓ Bucket '${BUCKET_NAME}' aangemaakt (publiek)\n`);
  } else {
    console.log(`✓ Bucket '${BUCKET_NAME}' bestaat al\n`);
  }

  // 2. Scan lokale afbeeldingen
  const images = scanImages();
  console.log(`📁 ${images.length} afbeeldingen gevonden\n`);

  // 3. Upload
  let uploaded = 0,
    failed = 0;
  const urlMap = new Map(); // bestandsnaam (lowercase) → supabase URL

  for (const img of images) {
    const buf = fs.readFileSync(img.fullPath);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(img.name, buf, { contentType: getMimeType(img.name), upsert: true });

    if (error) {
      console.warn(`  ⚠️  ${img.name}: ${error.message}`);
      failed++;
    } else {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(img.name)}`;
      urlMap.set(img.name.toLowerCase(), publicUrl);
      uploaded++;
      process.stdout.write(`\r  Geüpload: ${uploaded}/${images.length}`);
    }
  }
  console.log(`\n\n✓ Upload: ${uploaded} gelukt, ${failed} mislukt\n`);

  // 4. Database URLs bijwerken via pg
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  const { rows } = await db.query('SELECT id, url FROM "ProductImage"');
  console.log(`🔄 ${rows.length} afbeelding-URLs in database controleren...\n`);

  let updated = 0,
    unchanged = 0;
  for (const row of rows) {
    const url = row.url ?? "";
    let newUrl = null;

    if (url.startsWith("/products/")) {
      // Lokaal pad → zoek match
      const fname = url.replace("/products/", "").toLowerCase();
      newUrl = urlMap.get(fname);
    } else if (url.startsWith("https://")) {
      // WordPress URL → probeer lokale kopie
      const fname = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "").toLowerCase();
      newUrl = urlMap.get(fname);
    }

    if (newUrl && newUrl !== url) {
      await db.query('UPDATE "ProductImage" SET url = $1 WHERE id = $2', [newUrl, row.id]);
      updated++;
    } else {
      unchanged++;
    }
  }

  await db.end();
  console.log(`✓ URLs bijgewerkt : ${updated}`);
  console.log(`  Ongewijzigd     : ${unchanged}\n`);

  const domain = new URL(SUPABASE_URL).hostname;
  console.log("════════════════════════════════════════");
  console.log("✅ KLAAR!");
  console.log(`📦 Bucket URL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`);
  console.log(`🌐 Voeg toe aan next.config.js remotePatterns:`);
  console.log(`   { protocol: "https", hostname: "${domain}" }\n`);
}

main().catch((e) => {
  console.error("\n❌ FOUT:", e.message, "\n", e.stack);
  process.exit(1);
});
