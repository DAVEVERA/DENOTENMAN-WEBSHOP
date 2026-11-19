import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { BASE_URL, account, cart } from "@/lib/routes";

export default function robots(): MetadataRoute.Robots {
  const disallow = locales.flatMap((locale) => [
    cart(locale),
    account(locale),
    `/${locale}/admin`,
  ]);

  disallow.push("/admin", "/api");

  // Every group may read the site summary, including the training crawlers
  // that are otherwise blocked: a more specific Allow beats Disallow: /.
  const LLMS_TXT = "/llms.txt";

  return {
    rules: [
      {
        userAgent: ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User"],
        allow: ["/", LLMS_TXT],
        disallow,
      },
      {
        // Search/retrieval access is intentionally separate from model training.
        userAgent: ["GPTBot", "ClaudeBot"],
        allow: LLMS_TXT,
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: ["/", LLMS_TXT],
        disallow,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
