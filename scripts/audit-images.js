const path = require("path");
require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "dotenv@16.6.1", "node_modules", "dotenv"),
).config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "pg@8.20.0", "node_modules", "pg"),
);

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const r1 = await db.query(
    `SELECT COUNT(*) FROM "Product" WHERE "deletedAt" IS NULL AND status = 'active'`,
  );
  const r2 = await db.query(
    `SELECT COUNT(*) FROM "Product" p WHERE "deletedAt" IS NULL AND status = 'active' AND EXISTS (SELECT 1 FROM "ProductImage" pi WHERE pi."productId" = p.id)`,
  );
  const r3 = await db.query(
    `SELECT COUNT(*) FROM "Product" p WHERE "deletedAt" IS NULL AND status = 'active' AND NOT EXISTS (SELECT 1 FROM "ProductImage" pi WHERE pi."productId" = p.id)`,
  );
  const r4 = await db.query(`SELECT COUNT(*) FROM "ProductImage"`);
  const r5 = await db.query(
    `SELECT url FROM "ProductImage" WHERE url NOT LIKE '%supabase.co%' LIMIT 5`,
  );

  console.log("Totaal actieve producten :", r1.rows[0].count);
  console.log("Met afbeelding           :", r2.rows[0].count);
  console.log("ZONDER afbeelding        :", r3.rows[0].count);
  console.log("Totaal ProductImage rows :", r4.rows[0].count);
  console.log("\nNiet-Supabase URLs (max 5):");
  r5.rows.forEach((r) => console.log(" -", r.url));

  // Lijst zonder afbeelding
  const r6 = await db.query(`
    SELECT p.name, p.slug
    FROM "Product" p
    WHERE p."deletedAt" IS NULL AND p.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM "ProductImage" pi WHERE pi."productId" = p.id)
    ORDER BY p.name
    LIMIT 30
  `);
  console.log(`\nEerste 30 producten ZONDER afbeelding:`);
  r6.rows.forEach((r) => console.log(" -", r.name));

  await db.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
