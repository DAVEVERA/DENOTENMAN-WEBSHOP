import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { BASE_URL, product as productPath } from "@/lib/routes";
import { publicImageUrl } from "@/lib/storage";

export const runtime = "nodejs";

// Product search for the newsletter's product block: name, photo, "vanaf" price and link.
export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      translations: { some: { locale: "nl", ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}) } },
    },
    include: {
      translations: { where: { locale: "nl" }, take: 1 },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
      variants: { where: { isActive: true }, select: { priceCents: true, salePriceCents: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
  });

  const origin = BASE_URL.replace(/\/+$/u, "");
  return NextResponse.json({
    products: products.map((item) => {
      const translation = item.translations[0];
      const prices = item.variants.map((variant) => variant.salePriceCents ?? variant.priceCents);
      const lowest = prices.length ? Math.min(...prices) : item.salePriceCents ?? item.basePriceCents;
      return {
        productId: item.id,
        name: translation?.name ?? item.slug,
        imageUrl: item.images[0] ? publicImageUrl(item.images[0].storageKey) : "",
        priceLabel: `${prices.length > 1 ? "vanaf " : ""}${formatPrice(lowest, "nl")}`,
        url: `${origin}${productPath("nl", translation?.slug ?? item.slug)}`,
      };
    }),
  });
}
