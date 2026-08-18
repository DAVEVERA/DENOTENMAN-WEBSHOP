import { after } from "next/server";
import { isLocale, locales } from "@/lib/i18n";
import { categories, category, home, product } from "@/lib/routes";
import type { LocalizedSlug } from "@/lib/product-visibility";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
const MAX_INDEXNOW_URLS = 10_000;

export type IndexNowConfig = {
  siteOrigin: string;
  host: string;
  key: string;
  keyLocation: string;
};

type SubmissionResult =
  | { status: "disabled" | "skipped" | "failed"; submitted: 0 }
  | { status: "submitted"; submitted: number; statusCode: number };

export function readIndexNowConfig(
  env: NodeJS.ProcessEnv = process.env
): IndexNowConfig | undefined {
  const key = env.INDEXNOW_KEY;
  const siteUrl = env.SITE_URL;
  if (!key || !INDEXNOW_KEY_PATTERN.test(key) || !siteUrl) return undefined;

  try {
    const url = new URL(siteUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return undefined;
    }
    const siteOrigin = url.origin;
    return {
      siteOrigin,
      host: url.host,
      key,
      keyLocation: new URL("/indexnow-key.txt", siteOrigin).toString(),
    };
  } catch {
    return undefined;
  }
}

function sameOriginUrls(urls: readonly string[], siteOrigin: string): string[] {
  const unique = new Set<string>();

  for (const candidate of urls) {
    if (unique.size >= MAX_INDEXNOW_URLS) break;
    try {
      const url = new URL(candidate);
      if (url.origin !== siteOrigin) continue;
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      unique.add(url.toString());
    } catch {
      continue;
    }
  }

  return [...unique];
}

export async function submitIndexNowUrls(
  urls: readonly string[],
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<SubmissionResult> {
  const config = readIndexNowConfig(options.env);
  if (!config) return { status: "disabled", submitted: 0 };

  const urlList = sameOriginUrls(urls, config.siteOrigin);
  if (!urlList.length) return { status: "skipped", submitted: 0 };

  try {
    const response = await (options.fetchImpl ?? fetch)(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        host: config.host,
        key: config.key,
        keyLocation: config.keyLocation,
        urlList,
      }),
    });

    if (response.status !== 200 && response.status !== 202) {
      return { status: "failed", submitted: 0 };
    }
    return { status: "submitted", submitted: urlList.length, statusCode: response.status };
  } catch {
    return { status: "failed", submitted: 0 };
  }
}

function absoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function sharedStorefrontUrls(baseUrl: string): string[] {
  return locales.flatMap((locale) => [
    absoluteUrl(baseUrl, home(locale)),
    absoluteUrl(baseUrl, categories(locale)),
  ]);
}

export function buildProductIndexNowUrls(input: {
  baseUrl: string;
  translations: LocalizedSlug[];
  categoryTranslations: LocalizedSlug[];
}): string[] {
  const urls = new Set(sharedStorefrontUrls(input.baseUrl));
  for (const translation of input.translations) {
    if (isLocale(translation.locale)) {
      urls.add(absoluteUrl(input.baseUrl, product(translation.locale, translation.slug)));
    }
  }
  for (const translation of input.categoryTranslations) {
    if (isLocale(translation.locale)) {
      urls.add(absoluteUrl(input.baseUrl, category(translation.locale, translation.slug)));
    }
  }
  return [...urls];
}

export function buildCategoryIndexNowUrls(input: {
  baseUrl: string;
  translations: LocalizedSlug[];
}): string[] {
  const urls = new Set(sharedStorefrontUrls(input.baseUrl));
  for (const translation of input.translations) {
    if (isLocale(translation.locale)) {
      urls.add(absoluteUrl(input.baseUrl, category(translation.locale, translation.slug)));
    }
  }
  return [...urls];
}

export function scheduleIndexNowUrls(urls: readonly string[]): void {
  try {
    after(async () => {
      const result = await submitIndexNowUrls(urls);
      if (result.status === "failed") {
        console.error("IndexNow submission failed", { urlCount: urls.length });
      }
    });
  } catch {
    // The database mutation already succeeded. A missing request lifecycle
    // hook must never turn an admin save into a failure.
    console.error("IndexNow scheduling unavailable", { urlCount: urls.length });
  }
}
