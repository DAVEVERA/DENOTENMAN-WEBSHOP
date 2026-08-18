import { cache } from "react";
import { locales, type Locale } from "@/lib/i18n";
import {
  account,
  article,
  articles,
  cart,
  categories,
  category,
  home,
  product,
} from "@/lib/routes";
import { pagePath, type PageKey } from "@/lib/pages";
import { getCategory, getProductBySlug, getArticleBySlug } from "@/lib/queries";

export type AlternateKind =
  | { type: "home" }
  | { type: "categories" }
  | { type: "cart" }
  | { type: "account" }
  | { type: "articles" }
  | { type: "category"; slug: string }
  | { type: "product"; slug: string }
  | { type: "article"; slug: string }
  | { type: "page"; key: PageKey };

export type AlternatesResult = {
  canonical: string;
  languages: Partial<Record<Locale | "x-default", string>>;
};

export function withXDefault(
  languages: Partial<Record<Locale, string>>
): Partial<Record<Locale | "x-default", string>> {
  return languages.nl
    ? { ...languages, "x-default": languages.nl }
    : languages;
}

export const getAlternates = cache(
  async (locale: Locale, kind: AlternateKind): Promise<AlternatesResult | undefined> => {
    switch (kind.type) {
      case "home":
        return {
          canonical: home(locale),
          languages: withXDefault(
            Object.fromEntries(locales.map((loc) => [loc, home(loc)]))
          ),
        };
      case "categories":
        return {
          canonical: categories(locale),
          languages: withXDefault(
            Object.fromEntries(locales.map((loc) => [loc, categories(loc)]))
          ),
        };
      case "cart":
        return {
          canonical: cart(locale),
          languages: withXDefault(
            Object.fromEntries(locales.map((loc) => [loc, cart(loc)]))
          ),
        };
      case "account":
        return {
          canonical: account(locale),
          languages: withXDefault(
            Object.fromEntries(locales.map((loc) => [loc, account(loc)]))
          ),
        };
      case "articles":
        return {
          canonical: articles(locale),
          languages: withXDefault(
            Object.fromEntries(locales.map((loc) => [loc, articles(loc)]))
          ),
        };
      case "page":
        return {
          canonical: pagePath(kind.key, locale),
          languages: withXDefault(
            Object.fromEntries(locales.map((loc) => [loc, pagePath(kind.key, loc)]))
          ),
        };
      case "category": {
        const data = await getCategory(kind.slug, locale);

        if (!data) {
          return undefined;
        }

        return {
          canonical: category(locale, data.slug),
          languages: withXDefault(
            Object.fromEntries(locales.flatMap((loc) => {
              const slug = data.slugsByLocale[loc];
              return slug ? [[loc, category(loc, slug)] as const] : [];
            }))
          ),
        };
      }
      case "product": {
        const data = await getProductBySlug(kind.slug, locale);

        if (!data) {
          return undefined;
        }

        return {
          canonical: product(locale, data.slug),
          languages: withXDefault(
            Object.fromEntries(locales.flatMap((loc) => {
              const slug = data.slugsByLocale[loc];
              return slug ? [[loc, product(loc, slug)] as const] : [];
            }))
          ),
        };
      }
      case "article": {
        const data = await getArticleBySlug(kind.slug, locale);

        if (!data) {
          return undefined;
        }

        return {
          canonical: article(locale, data.slug),
          languages: withXDefault(
            Object.fromEntries(
              locales.flatMap((loc) => {
                const slug = data.slugsByLocale[loc];
                return slug ? [[loc, article(loc, slug)] as const] : [];
              })
            )
          ),
        };
      }
      default: {
        const exhaustiveCheck: never = kind;
        throw new Error(`Unhandled alternate kind: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }
  }
);
