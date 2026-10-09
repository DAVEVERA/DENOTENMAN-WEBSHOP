/**
 * Release gate for storefront imagery.
 *
 * Renders the homepage and every category page on one target origin — normally
 * a Cloud Run revision that has no traffic yet — collects every image
 * reference in the returned HTML, and fetches each one. A statically
 * prerendered page keeps the storage keys it was built with, so a photo that
 * was replaced after the build still points at a deleted object. That is
 * invisible until someone loads the page; this script makes it fail the
 * release instead.
 *
 * Usage:
 *   npm run images:scan -- --base=https://<tag>---<service>.run.app
 *   npm run images:scan -- --base=https://denotenman.com --include-products
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pLimit from "p-limit";

type ImageReference = {
  /** The URL as the browser would request it. */
  requestUrl: string;
  /** For `/_next/image` wrappers, the upstream object behind it. */
  upstreamUrl: string | null;
  kind: "optimizer" | "remote" | "local";
};

type CheckResult = ImageReference & {
  status: number | null;
  contentType: string | null;
  error: string | null;
  ok: boolean;
  referencedBy: string[];
};

export type ScanReport = {
  base: string;
  startedAt: string;
  finishedAt: string;
  pagesScanned: number;
  pagesFailed: { url: string; status: number | null; error: string | null }[];
  imagesChecked: number;
  broken: CheckResult[];
};

export type ScanOptions = {
  base: string;
  includeProducts: boolean;
  maxPages: number;
  concurrency: number;
  reportPath: string | null;
};

const locales = ["nl", "en", "fr"] as const;

export function parseScanOptions(argv: string[]): ScanOptions {
  let base: string | null = null;
  let includeProducts = false;
  let maxPages = 600;
  let concurrency = 8;
  let reportPath: string | null = null;

  for (const argument of argv) {
    if (argument.startsWith("--base=")) {
      const value = argument.slice("--base=".length);
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        throw new Error("--base must be an absolute http(s) URL");
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("--base must be an absolute http(s) URL");
      }
      base = parsed.origin;
    } else if (argument === "--include-products") {
      includeProducts = true;
    } else if (argument.startsWith("--max-pages=")) {
      maxPages = Number(argument.slice("--max-pages=".length));
      if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20_000) {
        throw new Error("--max-pages must be an integer between 1 and 20000");
      }
    } else if (argument.startsWith("--concurrency=")) {
      concurrency = Number(argument.slice("--concurrency=".length));
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
        throw new Error("--concurrency must be an integer between 1 and 32");
      }
    } else if (argument.startsWith("--report=")) {
      reportPath = argument.slice("--report=".length);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!base) throw new Error("Provide --base=<origin> of the revision to scan");
  return { base, includeProducts, maxPages, concurrency, reportPath };
}

/**
 * Sitemaps carry canonical denotenman.com URLs even when served from a
 * revision URL, so every discovered path is re-hosted onto the target.
 */
function rehost(rawUrl: string, base: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number | null; body: string; error: string | null }> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "denotenman-image-scan/1", "accept-language": "nl" },
    });
    const body = response.ok ? await response.text() : "";
    if (!response.ok) return { ok: false, status: response.status, body: "", error: null };
    return { ok: true, status: response.status, body, error: null };
  } catch (error) {
    return { ok: false, status: null, body: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export function extractSitemapLocations(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) =>
    match[1].trim().replace(/&amp;/g, "&")
  );
}

async function discoverPages(options: ScanOptions): Promise<string[]> {
  const pages = new Set<string>();

  for (const locale of locales) {
    pages.add(`${options.base}/${locale}`);
  }

  const sitemaps = ["categories", ...(options.includeProducts ? ["products"] : [])];
  for (const name of sitemaps) {
    const sitemapUrl = `${options.base}/${name}/sitemap.xml`;
    const sitemap = await fetchText(sitemapUrl);
    if (!sitemap.ok) {
      throw new Error(
        `Could not read ${sitemapUrl} (status ${sitemap.status ?? "network error"}${sitemap.error ? `: ${sitemap.error}` : ""})`
      );
    }
    for (const location of extractSitemapLocations(sitemap.body)) {
      const rehosted = rehost(location, options.base);
      if (rehosted) pages.add(rehosted);
    }
  }

  return Array.from(pages).slice(0, options.maxPages);
}

/**
 * Pulls image references out of rendered HTML. Covers `src`, every candidate
 * in a `srcset`, and preload links, in both the optimizer-wrapped and the
 * direct form, because a card can take either path depending on whether the
 * image pipeline has produced a variant for it yet.
 */
export function extractImageReferences(html: string, base: string): ImageReference[] {
  const candidates = new Set<string>();

  const attributePattern = /(?:src|href)="([^"]+)"/g;
  for (const match of html.matchAll(attributePattern)) {
    candidates.add(match[1]);
  }

  const srcSetPattern = /srcset="([^"]+)"/g;
  for (const match of html.matchAll(srcSetPattern)) {
    for (const entry of match[1].split(",")) {
      const url = entry.trim().split(/\s+/)[0];
      if (url) candidates.add(url);
    }
  }

  // Next serialises RSC payloads with escaped quotes; pick those up too.
  for (const match of html.matchAll(/\\"(\/_next\/image\?[^\\"]+)\\"/g)) {
    candidates.add(match[1].replace(/\\u0026/g, "&"));
  }

  const references = new Map<string, ImageReference>();

  for (const raw of candidates) {
    const decoded = raw.replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
    let absolute: URL;
    try {
      absolute = new URL(decoded, base);
    } catch {
      continue;
    }

    if (absolute.pathname === "/_next/image") {
      const inner = absolute.searchParams.get("url");
      if (!inner) continue;
      let upstream: string | null = null;
      try {
        upstream = new URL(inner, base).toString();
      } catch {
        upstream = null;
      }
      references.set(absolute.toString(), {
        requestUrl: absolute.toString(),
        upstreamUrl: upstream,
        kind: "optimizer",
      });
      continue;
    }

    if (!/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(absolute.pathname)) continue;

    const isLocal = absolute.origin === base;
    references.set(absolute.toString(), {
      requestUrl: absolute.toString(),
      upstreamUrl: null,
      kind: isLocal ? "local" : "remote",
    });
  }

  return Array.from(references.values());
}

async function checkImage(reference: ImageReference): Promise<Omit<CheckResult, "referencedBy">> {
  // The optimizer does not answer HEAD, so everything is fetched with GET and
  // the body is dropped as soon as the headers confirm an image came back.
  try {
    const response = await fetch(reference.requestUrl, {
      redirect: "follow",
      headers: { "user-agent": "denotenman-image-scan/1" },
    });
    const contentType = response.headers.get("content-type");
    await response.body?.cancel();
    const ok = response.ok && Boolean(contentType?.startsWith("image/"));
    return {
      ...reference,
      status: response.status,
      contentType,
      error: ok ? null : response.ok ? `Unexpected content-type: ${contentType ?? "none"}` : null,
      ok,
    };
  } catch (error) {
    return {
      ...reference,
      status: null,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

export async function scanStorefrontImages(options: ScanOptions): Promise<ScanReport> {
  const startedAt = new Date().toISOString();
  const pages = await discoverPages(options);
  const limit = pLimit(options.concurrency);

  const pagesFailed: ScanReport["pagesFailed"] = [];
  /** requestUrl -> pages that referenced it, so a failure names its sources. */
  const referencedBy = new Map<string, Set<string>>();
  const references = new Map<string, ImageReference>();

  await Promise.all(
    pages.map((page) =>
      limit(async () => {
        const result = await fetchText(page);
        if (!result.ok) {
          pagesFailed.push({ url: page, status: result.status, error: result.error });
          return;
        }
        for (const reference of extractImageReferences(result.body, options.base)) {
          references.set(reference.requestUrl, reference);
          const sources = referencedBy.get(reference.requestUrl) ?? new Set<string>();
          sources.add(page);
          referencedBy.set(reference.requestUrl, sources);

          // A working optimizer response can still hide a missing upstream
          // object once its cache entry expires, so check the object too.
          if (reference.upstreamUrl) {
            const upstream: ImageReference = {
              requestUrl: reference.upstreamUrl,
              upstreamUrl: null,
              kind: reference.upstreamUrl.startsWith(options.base) ? "local" : "remote",
            };
            references.set(upstream.requestUrl, upstream);
            const upstreamSources = referencedBy.get(upstream.requestUrl) ?? new Set<string>();
            upstreamSources.add(page);
            referencedBy.set(upstream.requestUrl, upstreamSources);
          }
        }
      })
    )
  );

  const checks = await Promise.all(
    Array.from(references.values()).map((reference) =>
      limit(async () => {
        const result = await checkImage(reference);
        return {
          ...result,
          referencedBy: Array.from(referencedBy.get(reference.requestUrl) ?? []).sort(),
        } satisfies CheckResult;
      })
    )
  );

  return {
    base: options.base,
    startedAt,
    finishedAt: new Date().toISOString(),
    pagesScanned: pages.length - pagesFailed.length,
    pagesFailed,
    imagesChecked: checks.length,
    broken: checks.filter((check) => !check.ok),
  };
}

export async function main(argv: string[]): Promise<number> {
  const options = parseScanOptions(argv);
  console.log(`Scanning ${options.base}${options.includeProducts ? " (including product pages)" : ""}…`);
  const report = await scanStorefrontImages(options);

  if (options.reportPath) {
    await mkdir(path.dirname(path.resolve(options.reportPath)), { recursive: true });
    await writeFile(path.resolve(options.reportPath), JSON.stringify(report, null, 2), "utf8");
    console.log(`Report written to ${options.reportPath}`);
  }

  console.log(
    `Pages scanned: ${report.pagesScanned}  images checked: ${report.imagesChecked}  broken: ${report.broken.length}`
  );

  for (const failure of report.pagesFailed) {
    console.error(`PAGE FAILED ${failure.status ?? failure.error} ${failure.url}`);
  }
  for (const broken of report.broken) {
    console.error(
      `BROKEN ${broken.status ?? broken.error} [${broken.kind}] ${broken.requestUrl}\n  referenced by: ${broken.referencedBy.join(", ")}`
    );
  }

  const failed = report.broken.length > 0 || report.pagesFailed.length > 0;
  console.log(failed ? "RESULT: FAIL — do not switch traffic" : "RESULT: PASS");
  return failed ? 1 : 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
