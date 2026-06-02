const path = require("path");
require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "dotenv@16.6.1", "node_modules", "dotenv"),
).config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require(
  path.join(__dirname, "..", "node_modules", ".pnpm", "pg@8.20.0", "node_modules", "pg"),
);
const https = require("https");

async function checkUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: "HEAD", timeout: 5000 }, (res) => {
      resolve(res.statusCode);
    });
    req.on("error", () => resolve(0));
    req.on("timeout", () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // Check first 20 URLs
  const { rows } = await db.query(`SELECT id, url FROM "ProductImage" LIMIT 20`);

  console.log("Checking 20 image URLs...\n");
  let ok = 0,
    fail = 0;
  for (const row of rows) {
    const status = await checkUrl(row.url);
    const icon = status === 200 ? "✅" : "❌";
    console.log(`${icon} ${status} — ${row.url.split("/").pop()}`);
    if (status === 200) ok++;
    else fail++;
  }

  console.log(`\n✅ ${ok} OK  ❌ ${fail} FAIL`);

  // Also show sample URLs for diagnosis
  const { rows: samples } = await db.query(`SELECT url FROM "ProductImage" LIMIT 3`);
  console.log("\nSample URLs in database:");
  samples.forEach((r) => console.log(r.url));

  await db.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
