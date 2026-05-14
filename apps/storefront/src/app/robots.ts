import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account/", "/winkelwagen", "/afrekenen", "/api/"],
      },
    ],
    sitemap: "https://denotenman.com/sitemap.xml",
    host: "https://denotenman.com",
  };
}
