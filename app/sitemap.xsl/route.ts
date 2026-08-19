const stylesheet = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <html lang="nl">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sitemap | De Notenman</title>
        <style>
          :root { color-scheme: light; --ink: #231f20; --muted: #6f685e; --line: #ded8cf; --cream: #f7f3ec; --paper: #fffdf9; --mustard: #e9b700; --green: #264c3c; }
          * { box-sizing: border-box; }
          body { margin: 0; background: var(--cream); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
          main { width: min(1040px, calc(100% - 32px)); margin: 48px auto; }
          .hero { position: relative; overflow: hidden; padding: clamp(28px, 5vw, 52px); border-radius: 24px 24px 0 0; background: var(--green); color: white; }
          .hero:after { content: ""; position: absolute; right: -72px; top: -96px; width: 250px; height: 250px; border: 42px solid rgba(233,183,0,.3); border-radius: 50%; }
          .eyebrow { display: inline-flex; align-items: center; min-height: 32px; padding: 5px 12px; border-radius: 999px; background: var(--mustard); color: var(--ink); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
          h1 { position: relative; margin: 18px 0 8px; font-size: clamp(32px, 6vw, 58px); line-height: 1; letter-spacing: -.035em; }
          .intro { position: relative; max-width: 650px; margin: 0; color: rgba(255,255,255,.82); font-size: clamp(16px, 2vw, 19px); }
          .panel { overflow: hidden; border: 1px solid var(--line); border-top: 0; border-radius: 0 0 24px 24px; background: var(--paper); box-shadow: 0 20px 55px rgba(50,42,31,.10); }
          .summary { display: flex; gap: 24px; justify-content: space-between; align-items: center; padding: 20px 28px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 14px; }
          .summary strong { color: var(--ink); }
          table { width: 100%; border-collapse: collapse; }
          th { padding: 14px 28px; background: #f2ede4; color: var(--muted); font-size: 12px; letter-spacing: .07em; text-align: left; text-transform: uppercase; }
          td { padding: 21px 28px; border-top: 1px solid var(--line); vertical-align: middle; }
          tbody tr:first-child td { border-top: 0; }
          tbody tr:hover { background: #fffbef; }
          a { color: var(--green); font-weight: 750; text-decoration-thickness: 1px; text-underline-offset: 4px; overflow-wrap: anywhere; }
          a:hover { color: #172f25; text-decoration-thickness: 2px; }
          .type { display: block; margin-bottom: 3px; color: var(--ink); font-weight: 800; }
          .url { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; }
          .date { color: var(--muted); white-space: nowrap; }
          footer { padding: 18px 28px 22px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
          @media (max-width: 640px) {
            main { width: min(100% - 20px, 1040px); margin: 10px auto; }
            .hero { border-radius: 18px 18px 0 0; }
            .panel { border-radius: 0 0 18px 18px; }
            .summary { align-items: flex-start; flex-direction: column; gap: 4px; padding: 16px 18px; }
            thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
            tr, td { display: block; }
            td { padding: 16px 18px 4px; border: 0; }
            td:last-child { padding: 0 18px 18px; border-bottom: 1px solid var(--line); }
            tbody tr:last-child td:last-child { border-bottom: 0; }
          }
        </style>
      </head>
      <body>
        <main>
          <header class="hero">
            <span class="eyebrow">Technische index</span>
            <h1>Sitemap</h1>
            <p class="intro">Een actueel overzicht van de openbare pagina's die De Notenman beschikbaar stelt aan zoekmachines.</p>
          </header>
          <section class="panel">
            <div class="summary">
              <span><strong><xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)" /></strong> gespecialiseerde sitemaps</span>
              <span>Automatisch bijgewerkt vanuit de webshop</span>
            </div>
            <table>
              <thead>
                <tr><th scope="col">Onderdeel</th><th scope="col">Laatst inhoudelijk gewijzigd</th></tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
                  <tr>
                    <td>
                      <span class="type">
                        <xsl:choose>
                          <xsl:when test="contains(sitemap:loc, '/products/')">Producten</xsl:when>
                          <xsl:when test="contains(sitemap:loc, '/categories/')">Categorieën</xsl:when>
                          <xsl:when test="contains(sitemap:loc, '/blog/')">Artikelen</xsl:when>
                          <xsl:otherwise>Pagina's</xsl:otherwise>
                        </xsl:choose>
                      </span>
                      <a href="{sitemap:loc}"><span class="url"><xsl:value-of select="sitemap:loc" /></span></a>
                    </td>
                    <td class="date">
                      <xsl:choose>
                        <xsl:when test="sitemap:lastmod"><xsl:value-of select="substring(sitemap:lastmod, 1, 10)" /></xsl:when>
                        <xsl:otherwise>—</xsl:otherwise>
                      </xsl:choose>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
            <footer>XML volgens het sitemap-protocol · UTF-8 · Alleen canonieke, indexeerbare URL's</footer>
          </section>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

export function GET(): Response {
  return new Response(stylesheet, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
