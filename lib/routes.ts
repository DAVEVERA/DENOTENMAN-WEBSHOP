import type { Locale } from "@/lib/i18n";
import { categoriesSegment, productsSegment } from "@/lib/segments";

export const BASE_URL = process.env.CDN_BASE_URL ?? "http://localhost:3000";

export function home(locale: Locale): string {
  return `/${locale}`;
}

export function category(locale: Locale, slug: string): string {
  return `/${locale}/${categoriesSegment[locale]}/${slug}`;
}

export function categories(locale: Locale): string {
  return `/${locale}/${categoriesSegment[locale]}`;
}

export function product(locale: Locale, slug: string): string {
  return `/${locale}/${productsSegment[locale]}/${slug}`;
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
