import { unstable_cache } from "next/cache";
import { getFilteredProducts } from "@/lib/queries";
import { BASE_URL } from "@/lib/routes";
import { buildGoogleMerchantFeedXml } from "@/lib/structured-data";

const getCachedMerchantProducts = unstable_cache(
  () => getFilteredProducts("all", "nl", [], { limit: 500 }),
  ["google-merchant-products-v1"],
  { revalidate: 3600, tags: ["google-merchant-products"] }
);

export async function GET() {
  const products = await getCachedMerchantProducts();
  const xml = buildGoogleMerchantFeedXml({ products, locale: "nl", baseUrl: BASE_URL });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
