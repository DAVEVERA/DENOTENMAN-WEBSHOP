import { cookies } from "next/headers";
import { calculateCart, type CartItem as CommerceCartItem } from "@denotenman/commerce";

const CART_COOKIE = "denotenman_cart";
const SHIPPING_CENTS = 695;
const FREE_SHIPPING_THRESHOLD_CENTS = 5000;

export type StorefrontCartItem = CommerceCartItem & {
  slug: string;
  image: string | null;
  weightId?: string | null;
  weightLabel?: string | null;
};

export type StorefrontCart = {
  items: StorefrontCartItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  itemCount: number;
};

function parseCartCookie(value?: string): StorefrontCartItem[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as StorefrontCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeCartCookie(items: StorefrontCartItem[]) {
  return JSON.stringify(items);
}

export function formatCartPrice(cents: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export async function getCart(): Promise<StorefrontCart> {
  const cookieStore = await cookies();
  const items = parseCartCookie(cookieStore.get(CART_COOKIE)?.value);
  const calculated = calculateCart(items);
  const shippingCents =
    calculated.totals.subtotalCents === 0 ||
    calculated.totals.subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : SHIPPING_CENTS;
  const totalWithShipping = calculateCart(items).totals.subtotalCents + shippingCents;

  return {
    items,
    subtotalCents: calculated.totals.subtotalCents,
    shippingCents,
    taxCents: Math.round(totalWithShipping * 0.09),
    totalCents: totalWithShipping + Math.round(totalWithShipping * 0.09),
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
  };
}

export async function setCartItems(items: StorefrontCartItem[]) {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, serializeCartCookie(items), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearCart() {
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE);
}

export function upsertCartItem(items: StorefrontCartItem[], nextItem: StorefrontCartItem) {
  const existing = items.find(
    (item) =>
      item.productId === nextItem.productId &&
      (item.variantId ?? null) === (nextItem.variantId ?? null) &&
      (item.weightId ?? null) === (nextItem.weightId ?? null),
  );

  if (!existing) return [...items, nextItem];

  return items.map((item) =>
    item === existing ? { ...item, quantity: item.quantity + nextItem.quantity } : item,
  );
}
