export type SitemapIndexEntry = {
  url: string;
  lastModified?: Date | string;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatLastModified(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid sitemap lastModified value: ${String(value)}`);
  }
  return date.toISOString();
}

export function buildSitemapIndexXml(
  entries: readonly SitemapIndexEntry[],
  stylesheetUrl = "/sitemap.xsl"
): string {
  const body = entries
    .map(({ url, lastModified }) => {
      const lastmod = lastModified
        ? `\n    <lastmod>${formatLastModified(lastModified)}</lastmod>`
        : "";
      return `  <sitemap>\n    <loc>${escapeXml(url)}</loc>${lastmod}\n  </sitemap>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<?xml-stylesheet type="text/xsl" href="${escapeXml(stylesheetUrl)}"?>`,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</sitemapindex>",
    "",
  ].join("\n");
}
