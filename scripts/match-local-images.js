/**
 * match-local-images.js
 *
 * 1. Kopieert alle lokale afbeeldingen (alleen de grootste variant, geen thumbnails)
 *    naar apps/storefront/public/products/
 * 2. Koppelt producten zonder afbeelding aan de best-matchende lokale bestand
 * 3. Werkt bestaande DB-URLs bij naar /products/<naam>.jpg (lokale URL)
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, "..");
const DB_DIR = path.join(ROOT, "Database");
const PUBLIC_DIR = path.join(ROOT, "apps", "storefront", "public", "products");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function similarity(a, b) {
  const na = normalize(a).split(" ");
  const nb = normalize(b).split(" ");
  const common = na.filter((w) => w.length > 2 && nb.includes(w));
  return common.length / Math.max(na.length, nb.length);
}

// ─── Scan lokale bestanden ─────────────────────────────────────────────────────

function scanImages() {
  const images = [];

  function recurse(dir, category) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        recurse(path.join(dir, entry.name), entry.name);
      } else if (
        entry.isFile() &&
        /\.(jpg|jpeg|png|webp)$/i.test(entry.name) &&
        // Sla thumbnails over (bijv. 100x100, 300x300)
        !entry.name.match(/\d+x\d+/)
      ) {
        images.push({
          name: entry.name,
          baseName: path.basename(entry.name, path.extname(entry.name)),
          fullPath: path.join(dir, entry.name),
          category,
        });
      }
    }
  }

  recurse(DB_DIR, "root");
  return images;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🖼️  Afbeeldingen koppelen & kopiëren");
  console.log("=====================================");

  // 1. Zorg dat de public/products/ map bestaat
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  console.log(`✓ Output map: ${PUBLIC_DIR}`);

  // 2. Scan lokale afbeeldingen
  const localImages = scanImages();
  console.log(`✓ ${localImages.length} lokale afbeeldingen gevonden`);

  // 3. Kopieer alle lokale afbeeldingen naar public/products/
  let copied = 0;
  for (const img of localImages) {
    const dest = path.join(PUBLIC_DIR, img.name);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(img.fullPath, dest);
      copied++;
    }
  }
  console.log(`✓ ${copied} nieuwe afbeeldingen gekopieerd`);

  // 4. Haal producten zonder afbeelding op
  const productsWithoutImage = await prisma.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, name: true, slug: true },
  });
  console.log(`\n📋 ${productsWithoutImage.length} producten zonder afbeelding:`);

  let matched = 0;
  let unmatched = 0;

  for (const product of productsWithoutImage) {
    // Zoek beste match op basis van naam
    let bestMatch = null;
    let bestScore = 0;

    for (const img of localImages) {
      const score = similarity(product.name, img.baseName.replace(/-/g, " "));
      if (score > bestScore) {
        bestScore = score;
        bestMatch = img;
      }
    }

    if (bestMatch && bestScore > 0.2) {
      const localUrl = `/products/${bestMatch.name}`;
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: localUrl,
          altText: product.name,
          position: 0,
        },
      });
      console.log(
        `  ✓ ${product.name.padEnd(40)} → ${bestMatch.name} (${Math.round(bestScore * 100)}%)`,
      );
      matched++;
    } else {
      console.log(
        `  ⚠️  ${product.name.padEnd(40)} → geen match (score: ${Math.round(bestScore * 100)}%)`,
      );
      unmatched++;
    }
  }

  // 5. Update bestaande externe URLs naar lokale kopieën waar mogelijk
  console.log("\n🔄 Externe URLs koppelen aan lokale kopieën...");
  const allImages = await prisma.productImage.findMany({
    where: { url: { startsWith: "https://" } },
    select: { id: true, url: true, productId: true },
  });

  let updated = 0;
  for (const img of allImages) {
    // Haal bestandsnaam uit de URL
    const urlFileName = path.basename(img.url).split("?")[0];
    // Zoek of dit lokaal beschikbaar is
    const localMatch = localImages.find(
      (l) =>
        l.name === urlFileName ||
        l.baseName === path.basename(urlFileName, path.extname(urlFileName)),
    );
    if (localMatch) {
      await prisma.productImage.update({
        where: { id: img.id },
        data: { url: `/products/${localMatch.name}` },
      });
      updated++;
    }
  }
  console.log(`✓ ${updated} externe URLs bijgewerkt naar lokale pad`);

  // ─── Samenvatting ─────────────────────────────────────────────────────────
  const finalImgs = await prisma.productImage.count();
  const finalNoImg = await prisma.product.count({ where: { images: { none: {} } } });

  console.log("\n════════════════════════════════");
  console.log(`🖼️  Totaal afbeeldingen : ${finalImgs}`);
  console.log(`✅ Nieuw gekoppeld     : ${matched}`);
  console.log(`🔄 URLs bijgewerkt     : ${updated}`);
  console.log(`⚠️  Nog zonder foto    : ${finalNoImg}`);
  if (unmatched > 0) console.log(`❓ Geen match         : ${unmatched}`);
  console.log("════════════════════════════════");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
