import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findOrderForLookup } from "@/lib/orders";

type OrderLookupRequestBody = {
  orderId: string;
  email: string;
};

function isOrderLookupRequestBody(value: unknown): value is OrderLookupRequestBody {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OrderLookupRequestBody>;
  return typeof candidate.orderId === "string" && typeof candidate.email === "string";
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (!isOrderLookupRequestBody(body) || !body.orderId.trim() || !body.email.trim()) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const order = await findOrderForLookup(body.orderId.trim(), body.email);

  if (!order) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    subtotalCents: order.subtotalCents,
    discountCode: order.discountCode,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    deliveryMethod: order.deliveryMethod,
    pickupLocationId: order.pickupLocationId,
    shippingStreet: order.shippingStreet,
    shippingHouseNumber: order.shippingHouseNumber,
    shippingPostalCode: order.shippingPostalCode,
    shippingCity: order.shippingCity,
    shippingCountry: order.shippingCountry,
    postnlTrackingCode: order.postnlTrackingCode,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
  });
}
