/**
 * update-db-urls.js — Alleen de database-URLs bijwerken naar Supabase Storage
 * Run NADAT upload-to-supabase.js klaar is.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { Client } = require("pg");

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const DATABASE_URL = process.env.DATABASE_URL;
const BUCKET_NAME = "product-images";

if (!SUPABASE_URL || !DATABASE_URL) {
  console.error("❌ Vul SUPABASE_URL en DATABASE_URL in in .env");
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`;

async function main() {
  console.log("🔄 Database-URLs bijwerken naar Supabase Storage...\n");

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  console.log("✓ Verbonden met database\n");

  const { rows } = await db.query('SELECT id, url FROM "ProductImage"');
  console.log(`📋 ${rows.length} product-afbeeldingen gevonden\n`);

  let updated = 0;
  let unchanged = 0;
  let already = 0;

  for (const row of rows) {
    const url = row.url ?? "";

    // Al een Supabase URL? Skip.
    if (url.startsWith(BASE) || url.includes("supabase.co")) {
      already++;
      continue;
    }

    let fileName = null;

    // Lokaal pad: /products/Amandelen.jpg
    if (url.startsWith("/products/")) {
      fileName = url.replace("/products/", "");
    }
    // WordPress URL: https://denotenman.com/wp-content/uploads/.../bestand.jpg
    else if (url.startsWith("https://") || url.startsWith("http://")) {
      fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "");
    }

    if (fileName) {
      const newUrl = `${BASE}/${encodeURIComponent(fileName)}`;
      await db.query('UPDATE "ProductImage" SET url = $1 WHERE id = $2', [newUrl, row.id]);
      updated++;
    } else {
      unchanged++;
    }
  }

  await db.end();

  console.log(`✅ Bijgewerkt      : ${updated}`);
  console.log(`⏭️  Al Supabase URL : ${already}`);
  console.log(`⏸️  Ongewijzigd     : ${unchanged}`);
  console.log("\n🎉 Klaar! Herstart de storefront dev server om de nieuwe afbeeldingen te zien.");
}

main().catch((e) => {
  console.error("\n❌ FOUT:", e.message);
  console.error(e.stack);
  process.exit(1);
});
