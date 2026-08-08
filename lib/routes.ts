import type { Locale } from "@/lib/i18n";

export const BASE_URL = process.env.CDN_BASE_URL ?? "http://localhost:3000";

export const contentPages = ["about", "shipping", "returns", "privacy", "terms"] as const;

export type ContentPage = (typeof contentPages)[number];

export function home(locale: Locale): string {
  return `/${locale}`;
}

export function collection(locale: Locale, slug: string): string {
  return `/${locale}/collections/${slug}`;
}

export function collections(locale: Locale): string {
  return `/${locale}/collections`;
}

export function product(locale: Locale, slug: string): string {
  return `/${locale}/products/${slug}`;
}

export function page(locale: Locale, slug: ContentPage): string {
  return `/${locale}/pages/${slug}`;
}

export function articles(locale: Locale): string {
  return `/${locale}/blogs/articles`;
}

export function article(locale: Locale, slug: string): string {
  return `/${locale}/blogs/articles/${slug}`;
}

export function cart(locale: Locale): string {
  return `/${locale}/cart`;
}

export function account(locale: Locale): string {
  return `/${locale}/account`;
}
