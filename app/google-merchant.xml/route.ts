import { getFilteredProducts } from "@/lib/queries";
import { BASE_URL } from "@/lib/routes";
import { buildGoogleMerchantFeedXml } from "@/lib/structured-data";

export async function GET() {
  const products = await getFilteredProducts("all", "nl", [], { limit: 500 });
  const xml = buildGoogleMerchantFeedXml({ products, locale: "nl", baseUrl: BASE_URL });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
