import { isLocale } from "@/lib/i18n";
import { getProductSummaryById } from "@/lib/queries";

export async function GET(
  request: Request,
  context: RouteContext<"/api/storefront/products/[id]">
) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const { id } = await context.params;

  if (!isLocale(locale) || !id || id.length > 100) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const product = await getProductSummaryById(id, locale);
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json(product, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to load storefront quick view", { id, locale, error });
    return Response.json({ error: "Product unavailable" }, { status: 500 });
  }
}
