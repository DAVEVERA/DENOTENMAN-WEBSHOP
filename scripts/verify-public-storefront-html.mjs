// Read-only live SSR smoke check. Intentionally uses the initial HTTP body,
// without executing JavaScript or changing any storefront data.
const paths = [
  "/nl/producten/amandelen-wit-gebrand-gezouten",
  "/nl/producten/chocolade-amandelen-puur",
];
const origin = "https://denotenman.com";
let failed = false;
for (const path of paths) {
  const url = new URL(path, origin);
  try {
    const response = await fetch(url, {
      headers: { accept: "text/html", "user-agent": "DeNotenman-SSR-Audit/1.0" },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const html = await response.text();
    const body = html.match(/<body\\b[^>]*>([\\s\\S]*?)<\\/body>/i)?.[1] ?? "";
    const readable = body.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, " ")
      .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, " ");
    const h1 = [...readable.matchAll(/<h1\\b[^>]*>([\\s\\S]*?)<\\/h1>/gi)]
      .map((match) => match[1].replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim());
    const paragraphs = [...readable.matchAll(/<p\\b[^>]*>([\\s\\S]*?)<\\/p>/gi)]
      .map((match) => match[1].replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim());
    const markedDescription = /data-geo-product-description=["']true["']/i.test(readable);
    const longParagraphs = paragraphs.filter((paragraph) => paragraph.length >= 60).length;
    const jsonLdPresent = /<script\\b[^>]*type=["']application\\/ld\\+json["']/i.test(html);
    console.log(JSON.stringify({
      url: url.href, status: response.status, htmlBytes: Buffer.byteLength(html),
      h1, longParagraphs, markedDescription, jsonLdPresent,
    }));
    if (!response.ok || h1.length !== 1 || !h1[0] || longParagraphs === 0 || !jsonLdPresent) failed = true;
  } catch (error) {
    console.error(JSON.stringify({ url: url.href, error: error instanceof Error ? error.message : String(error) }));
    failed = true;
  }
}
if (failed) process.exitCode = 1;
