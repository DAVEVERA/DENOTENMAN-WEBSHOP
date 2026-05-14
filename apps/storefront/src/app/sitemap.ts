import type { MetadataRoute } from "next";
import type { Paginated, Product, CategoryTree } from "@denotenman/schemas";
import { serverApiClient } from "@/lib/server-api";

const BASE_URL = "https://denotenman.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/over-ons`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/verzending`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/algemene-voorwaarden`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  try {
    const api = serverApiClient();
    const emptyCategories: CategoryTree[] = [];
    const emptyProducts: Paginated<Product> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 500,
    };

    const [categories, products] = await Promise.all([
      api.categories.list().catch((): CategoryTree[] => emptyCategories),
      api.products.list({ pageSize: 500 }).catch((): Paginated<Product> => emptyProducts),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${BASE_URL}/categorie/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const productRoutes: MetadataRoute.Sitemap = products.items.map((product) => ({
      url: `${BASE_URL}/product/${product.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
