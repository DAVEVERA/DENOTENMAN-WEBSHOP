import { isLocale } from "@/lib/i18n";
import {
  catalogPageSize,
  getCatalogProducts,
  normalizeCatalogFilterValues,
} from "@/lib/queries";
import { normalizeCatalogSort } from "@/lib/catalog-sort";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? "";

  if (!isLocale(locale)) {
    return Response.json({ error: "Invalid locale" }, { status: 400 });
  }

  const query = (url.searchParams.get("q") ?? "").slice(0, 100);
  const filters = normalizeCatalogFilterValues(
    (url.searchParams.get("f") ?? "").split(",")
  );
  const sort = normalizeCatalogSort(url.searchParams.get("sort"));
  const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  try {
    const page = await getCatalogProducts(locale, {
      query,
      filters,
      sort,
      limit: catalogPageSize,
      offset,
    });

    return Response.json(page, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to load storefront catalog page", { locale, offset, error });
    return Response.json({ error: "Catalog unavailable" }, { status: 500 });
  }
}
