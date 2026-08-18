import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { BASE_URL, account, cart } from "@/lib/routes";

export default function robots(): MetadataRoute.Robots {
  const disallow = locales.flatMap((locale) => [
    cart(locale),
    account(locale),
    `/${locale}/admin`,
  ]);

  disallow.push("/api");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/products/sitemap.xml`,
      `${BASE_URL}/categories/sitemap.xml`,
      `${BASE_URL}/blog/sitemap.xml`,
    ],
  };
}
