import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLocale } from "@/lib/i18n";
import { createOrderWithPayment, CheckoutError, type CartLineInput } from "@/lib/orders";

type CheckoutRequestBody = {
  locale: string;
  contact: {
    name: string;
    email: string;
    phone?: string;
    deliveryMethod: "SHIPPING" | "PICKUP";
    pickupLocationId?: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    country: string;
  };
  lines: CartLineInput[];
  discountCode?: string;
};

function isCheckoutRequestBody(value: unknown): value is CheckoutRequestBody {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CheckoutRequestBody>;
  return (
    typeof candidate.locale === "string" &&
    typeof candidate.contact === "object" &&
    candidate.contact !== null &&
    (candidate.contact.deliveryMethod === "SHIPPING" ||
      candidate.contact.deliveryMethod === "PICKUP") &&
    Array.isArray(candidate.lines) &&
    (candidate.discountCode === undefined || typeof candidate.discountCode === "string")
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isCheckoutRequestBody(body) || !isLocale(body.locale)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const lines: CartLineInput[] = body.lines
    .filter(
      (line): line is CartLineInput =>
        typeof line?.variantId === "string" && typeof line?.quantity === "number"
    )
    .map((line) => ({ variantId: line.variantId, quantity: line.quantity }));

  try {
    const { orderId, checkoutUrl } = await createOrderWithPayment(
      body.locale,
      body.contact,
      lines,
      body.discountCode
    );
    return NextResponse.json({ orderId, checkoutUrl });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 422 });
    }
    console.error("Checkout failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
