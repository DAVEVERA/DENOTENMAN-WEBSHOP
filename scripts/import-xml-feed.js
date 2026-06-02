/**
 * import-xml-feed.js
 * Importeert alle producten uit Database/producten.txt (Google Shopping XML)
 * naar de lokale PostgreSQL database via Prisma.
 *
 * Gebruik (vanuit project root):
 *   node scripts/import-xml-feed.js
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { parseStringPromise } = require("xml2js");

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function guessCategory(title) {
  const t = title.toLowerCase();
  if (t.includes("chocolade") || t.includes("truffel")) return "chocolade";
  if (t.includes("pasta") || t.includes("tahin")) return "mixen";
  if (t.includes("honing")) return "honing";
  if (
    t.includes("zaad") ||
    t.includes("pitten") ||
    t.includes("lijnzaad") ||
    t.includes("chiazaad") ||
    t.includes("pompoenpit") ||
    t.includes("zonnebloem") ||
    t.includes("sesamzaad") ||
    t.includes("quinoa") ||
    t.includes("pijnboom")
  )
    return "pitten-en-zaden";
  if (
    t.includes("goji") ||
    t.includes("kokospoeder") ||
    t.includes("hennep") ||
    t.includes("superfood")
  )
    return "superfoods";
  if (
    t.includes("dadel") ||
    t.includes("rozijn") ||
    t.includes("abrikoos") ||
    t.includes("vijg") ||
    t.includes("cranberry") ||
    t.includes("mango") ||
    t.includes("papaya") ||
    t.includes("ananas") ||
    t.includes("kersen") ||
    t.includes("pruim") ||
    t.includes("gember") ||
    t.includes("appel") ||
    t.includes("sinaasappel") ||
    t.includes("citroen") ||
    t.includes("fruitmix") ||
    t.includes("moerbei") ||
    t.includes("zuidvruch")
  )
    return "gedroogd-fruit";
  if (
    t.includes("chip") ||
    t.includes("cracker") ||
    t.includes("rotsje") ||
    t.includes("groentechips") ||
    t.includes("bananenchips") ||
    t.includes("edamame") ||
    t.includes("suikerpinda")
  )
    return "snacks";
  return "noten";
}

function extractWeight(title) {
  const kgMatch = title.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1].replace(",", ".")) * 1000);
  const gramMatch = title.match(/(\d+)\s*g(?:ram)?/i);
  if (gramMatch) return parseInt(gramMatch[1], 10);
  return 250;
}

function parsePriceCents(priceStr) {
  if (!priceStr) return 0;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return Math.round((isNaN(num) ? 0 : num) * 100);
}

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/ç/g, "c")
    .replace(/ý/g, "y")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📦 Denotenman product importer");
  console.log("================================");

  // 1. Lees XML
  const xmlPath = path.resolve(__dirname, "../Database/producten.txt");
  if (!fs.existsSync(xmlPath)) throw new Error(`Bestand niet gevonden: ${xmlPath}`);
  let xml = fs.readFileSync(xmlPath, "utf-8");
  if (!xml.trimStart().startsWith("<")) {
    const rssIndex = xml.indexOf("<rss");
    if (rssIndex === -1) throw new Error("Geen geldig XML gevonden in bestand");
    xml = xml.substring(rssIndex);
  }
  // Fix: & in URLs zijn niet escaped in de feed → vervang & door &amp; maar laat bestaande entiteiten intact
  xml = xml.replace(/&(?![a-zA-Z#][a-zA-Z0-9#]{0,6};)/g, "&amp;");
  console.log("✓ XML gesaneerd (& escaped)");

  // 2. Parse
  const parsed = await parseStringPromise(xml, { explicitArray: true });
  const items = parsed?.rss?.channel?.[0]?.item ?? [];
  console.log(`✓ ${items.length} items gevonden`);

  // 3. Categorieën
  const categoryIds = new Map();
  const catDefs = [
    { slug: "noten", name: "Noten" },
    { slug: "chocolade", name: "Chocolade" },
    { slug: "honing", name: "Honing" },
    { slug: "mixen", name: "Mixen & Pasta's" },
    { slug: "snacks", name: "Snacks" },
    { slug: "superfoods", name: "Superfoods" },
    { slug: "pitten-en-zaden", name: "Pitten & Zaden" },
    { slug: "gedroogd-fruit", name: "Gedroogd Fruit" },
  ];
  for (const cat of catDefs) {
    const existing = await prisma.category.findFirst({ where: { parentId: null, slug: cat.slug } });
    const record = existing
      ? existing
      : await prisma.category.create({ data: { slug: cat.slug, name: cat.name } });
    categoryIds.set(cat.slug, record.id);
  }
  console.log(`✓ ${categoryIds.size} categorieën gereed`);

  // 4. Groepeer varianten
  const groups = new Map();
  const singles = [];
  for (const item of items) {
    const groupId = item["g:item_group_id"]?.[0];
    if (groupId && groupId !== "0" && groupId !== "") {
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(item);
    } else {
      singles.push(item);
    }
  }
  console.log(`✓ ${groups.size} productgroepen, ${singles.length} losse items`);
  console.log("⏳ Importeren...\n");

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  async function importProduct(mainItem, allItems) {
    const id = mainItem["g:id"]?.[0] ?? "0";
    const title = mainItem["g:title"]?.[0] ?? "Onbekend";
    const description = mainItem["g:description"]?.[0] ?? null;
    const imageUrl = mainItem["g:image_link"]?.[0] ?? null;
    const availability = mainItem["g:availability"]?.[0] ?? "in_stock";

    const catSlug = guessCategory(title);
    const categoryId = categoryIds.get(catSlug) ?? categoryIds.get("noten");
    const cleanName = title.replace(/\s*\(\d+\s*(?:gram|kg|g)\)/i, "").trim();
    const slug = toSlug(cleanName) || `product-${id}`;
    const sku = `WC-${id}`;

    const variantItems = allItems.length > 0 ? allItems : [mainItem];
    const variantData = variantItems.map((v, i) => {
      const vTitle = v["g:title"]?.[0] ?? title;
      const weightGrams = extractWeight(vTitle);
      const priceCents = parsePriceCents(v["g:price"]?.[0] ?? "0");
      const vId = v["g:id"]?.[0] ?? id;
      const variantName = weightGrams >= 1000 ? `${weightGrams / 1000} kg` : `${weightGrams} g`;
      return {
        sku: `WC-${vId}-${weightGrams}g`,
        name: variantName,
        weightGrams,
        priceCents,
        stockQuantity: availability === "in_stock" ? 10 : 0,
        position: i,
      };
    });

    try {
      const existingSku = await prisma.product.findUnique({ where: { sku } });
      if (existingSku) {
        skipped++;
        return;
      }

      const existingSlug = await prisma.product.findUnique({ where: { slug } });
      const finalSlug = existingSlug ? `${slug}-${id}` : slug;

      await prisma.product.create({
        data: {
          sku,
          slug: finalSlug,
          name: cleanName,
          description,
          categoryId,
          status: "active",
          variants: { create: variantData },
          ...(imageUrl
            ? {
                images: { create: { url: imageUrl, altText: cleanName, position: 0 } },
              }
            : {}),
        },
      });
      imported++;
      if (imported % 25 === 0) process.stdout.write(`  ${imported} producten...\n`);
    } catch (e) {
      errors++;
      console.warn(`  ⚠️  "${title}": ${e.message?.slice(0, 100)}`);
    }
  }

  // 5. Importeer groepen
  for (const groupItems of groups.values()) {
    const sorted = [...groupItems].sort(
      (a, b) => parseInt(a["g:id"]?.[0] ?? "0") - parseInt(b["g:id"]?.[0] ?? "0"),
    );
    await importProduct(sorted[0], sorted);
  }

  // 6. Importeer losse items
  for (const item of singles) {
    await importProduct(item, []);
  }

  console.log("");
  console.log("════════════════════════════════");
  console.log(`✅ Geïmporteerd : ${imported}`);
  console.log(`⏭️  Overgeslagen  : ${skipped}`);
  console.log(`❌ Fouten       : ${errors}`);
  console.log("════════════════════════════════");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
