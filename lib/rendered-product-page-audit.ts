import type { AuditLocale } from "@/lib/product-audit-core";

export type RenderedPageCheck = {
  code:
    | "http-status"
    | "title"
    | "meta-description"
    | "canonical"
    | "hreflang"
    | "robots"
    | "h1"
    | "product-jsonld";
  label: string;
  passed: boolean;
  detail: string;
};

export type RenderedProductPageAudit = {
  locale: AuditLocale;
  url: string;
  status: number;
  score: number;
  checks: RenderedPageCheck[];
};

export type RenderedProductPageTarget = {
  locale: AuditLocale;
  path: string;
  productName: string;
};

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1]?.trim() || null;
}

function matchingTag(html: string, tagName: "meta" | "link", attributeName: string, value: string): string | null {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
  return tags.find((tag) => attribute(tag, attributeName)?.toLowerCase() === value.toLowerCase()) ?? null;
}

function decodeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return decodeText(value).normalize("NFKC").toLocaleLowerCase("nl-NL");
}

function containsProductJsonLd(html: string): boolean {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => attribute(`<script ${match[1]}>`, "type")?.toLowerCase() === "application/ld+json");

  const hasProductType = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasProductType);
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return true;
    return Object.values(record).some(hasProductType);
  };

  return scripts.some((match) => {
    try {
      return hasProductType(JSON.parse(match[2]));
    } catch {
      return false;
    }
  });
}

export function auditRenderedProductPageHtml(input: {
  locale: AuditLocale;
  url: string;
  status: number;
  html: string;
  productName: string;
}): RenderedProductPageAudit {
  const title = decodeText(input.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const descriptionTag = matchingTag(input.html, "meta", "name", "description");
  const metaDescription = descriptionTag ? attribute(descriptionTag, "content") ?? "" : "";
  const robotsTag = matchingTag(input.html, "meta", "name", "robots");
  const robots = robotsTag ? attribute(robotsTag, "content") ?? "" : "";
  const canonicalTag = matchingTag(input.html, "link", "rel", "canonical");
  const canonical = canonicalTag ? attribute(canonicalTag, "href") ?? "" : "";
  const alternateTags = input.html.match(/<link\b[^>]*>/gi) ?? [];
  const hreflangs = new Set(
    alternateTags
      .filter((tag) => attribute(tag, "rel")?.toLowerCase() === "alternate")
      .map((tag) => attribute(tag, "hreflang")?.toLowerCase())
      .filter((value): value is string => Boolean(value))
  );
  const h1Matches = [...input.html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const expectedPath = new URL(input.url).pathname.replace(/\/$/, "");
  let canonicalPath = "";
  try {
    canonicalPath = new URL(canonical, input.url).pathname.replace(/\/$/, "");
  } catch {
    canonicalPath = "";
  }

  const checks: RenderedPageCheck[] = [
    { code: "http-status", label: "HTTP-status", passed: input.status >= 200 && input.status < 300, detail: `HTTP ${input.status}` },
    { code: "title", label: "Paginatitel", passed: Boolean(title) && normalize(title).includes(normalize(input.productName)), detail: title || "Titel ontbreekt" },
    { code: "meta-description", label: "Metaomschrijving", passed: decodeText(metaDescription).length >= 30, detail: metaDescription || "Metaomschrijving ontbreekt" },
    { code: "canonical", label: "Canonical", passed: Boolean(canonical) && Boolean(canonicalPath) && canonicalPath === expectedPath, detail: canonical || "Canonical ontbreekt" },
    { code: "hreflang", label: "Hreflang", passed: (["nl", "en", "fr"] as const).every((locale) => hreflangs.has(locale)), detail: hreflangs.size ? [...hreflangs].join(", ") : "Hreflang ontbreekt" },
    { code: "robots", label: "Indexeerbaarheid", passed: input.status > 0 && !/\bnoindex\b/i.test(robots), detail: input.status === 0 ? "Pagina kon niet worden opgehaald" : robots || "Geen beperkende robots-meta" },
    { code: "h1", label: "H1", passed: h1Matches.length === 1 && normalize(h1Matches[0]?.[1] ?? "").includes(normalize(input.productName)), detail: `${h1Matches.length} H1-kop(pen)` },
    { code: "product-jsonld", label: "Product structured data", passed: containsProductJsonLd(input.html), detail: containsProductJsonLd(input.html) ? "Product JSON-LD gevonden" : "Product JSON-LD ontbreekt" },
  ];
  const passed = checks.filter((check) => check.passed).length;

  return {
    locale: input.locale,
    url: input.url,
    status: input.status,
    score: Math.round((passed / checks.length) * 100),
    checks,
  };
}

export async function auditRenderedProductPages(
  pages: RenderedProductPageTarget[],
  options: {
    baseUrl: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  }
): Promise<RenderedProductPageAudit[]> {
  const baseUrl = new URL(options.baseUrl);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  return Promise.all(pages.map(async (page) => {
    const url = new URL(page.path, baseUrl);
    if (url.origin !== baseUrl.origin) {
      return auditRenderedProductPageHtml({ ...page, url: url.toString(), status: 0, html: "" });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url.toString(), {
        cache: "no-store",
        headers: { accept: "text/html" },
        signal: controller.signal,
      });
      const html = (await response.text()).slice(0, 2_000_000);
      return auditRenderedProductPageHtml({
        ...page,
        url: url.toString(),
        status: response.status,
        html,
      });
    } catch {
      return auditRenderedProductPageHtml({ ...page, url: url.toString(), status: 0, html: "" });
    } finally {
      clearTimeout(timeout);
    }
  }));
}
