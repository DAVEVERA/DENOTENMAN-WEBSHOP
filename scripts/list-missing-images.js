const path = require("path");
const fs = require("fs");
const https = require("https");

require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "dotenv@16.6.1", "node_modules", "dotenv"),
).config({ path: path.join(__dirname, "..", ".env") });

const { Client } = require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "pg@8.20.0", "node_modules", "pg"),
);

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

function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop());
  } catch {
    return url;
  }
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { rows } = await db.query(`
    SELECT p.name, p.slug, pi.url, pi.id as img_id
    FROM "ProductImage" pi
    JOIN "Product" p ON p.id = pi."productId"
    ORDER BY p.name
  `);

  console.log(`Controleren van ${rows.length} URLs...\n`);
  const missing = [];
  let checked = 0;

  for (const row of rows) {
    const s = await checkStatus(row.url);
    if (s !== 200) {
      missing.push({ product: row.name, slug: row.slug, file: fileNameFromUrl(row.url) });
    }
    checked++;
    if (checked % 50 === 0) process.stdout.write(`  ${checked}/${rows.length}\r`);
  }

  console.log(`\n\n❌ ${missing.length} producten met ontbrekende afbeelding:\n`);

  const lines = missing.map((m) => `${m.product.padEnd(50)} | ${m.file}`);
  console.log("Productnaam".padEnd(50) + " | Bestandsnaam");
  console.log("-".repeat(90));
  lines.forEach((l) => console.log(l));

  // Write to file
  const out = ["Productnaam;Bestandsnaam", ...missing.map((m) => `${m.product};${m.file}`)].join(
    "\n",
  );
  fs.writeFileSync(path.join(__dirname, "..", "ontbrekende-afbeeldingen.csv"), out, "utf-8");
  console.log(`\n✅ Lijst opgeslagen: ontbrekende-afbeeldingen.csv`);

  await db.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
