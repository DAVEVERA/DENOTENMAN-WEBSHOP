import { getCategoryLinks, listProducts } from "../../lib/products";
import { SITE_BASE_URL } from "../../lib/seo";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const products = await listProducts();
  const categories = getCategoryLinks(products);

  const routes = [
    "",
    "/winkel",
    "/zoeken",
    "/marktlocaties",
    "/account",
    "/zakelijk",
    "/klantenservice",
    "/over-ons",
    "/privacyverklaring",
    "/algemene-voorwaarden",
    "/retourbeleid",
    "/cookiebeleid",
    "/blog",
    ...categories.map((category) => category.href),
    ...products.map((product) => `/winkel/${product.slug}`),
  ];

  const urls = Array.from(new Set(routes))
    .map((route) => {
      const isProduct = route.startsWith("/winkel/");
      const isCategory = route.startsWith("/categorie/");
      const priority = route === "" ? "1.0" : isProduct || isCategory ? "0.8" : "0.7";

      return `
        <url>
          <loc>${escapeXml(`${SITE_BASE_URL}${route}`)}</loc>
          <changefreq>${isProduct || isCategory ? "weekly" : "monthly"}</changefreq>
          <priority>${priority}</priority>
        </url>
      `;
    })
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${urls}
      </urlset>`,
    {
      headers: {
        "Content-Type": "application/xml",
      },
    },
  );
}
