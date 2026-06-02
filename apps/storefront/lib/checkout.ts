import { cookies } from "next/headers";

const CHECKOUT_COOKIE = "denotenman_checkout";

export type CheckoutState = {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  shippingMethodId?: string;
  shippingNote?: string;
  paymentMethod?: "mollie";
  termsAccepted?: boolean;
};

function parseCheckoutCookie(value?: string): CheckoutState {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as CheckoutState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getCheckoutState() {
  const cookieStore = await cookies();
  return parseCheckoutCookie(cookieStore.get(CHECKOUT_COOKIE)?.value);
}

export async function updateCheckoutState(patch: CheckoutState) {
  const cookieStore = await cookies();
  const current = await getCheckoutState();
  cookieStore.set(CHECKOUT_COOKIE, JSON.stringify({ ...current, ...patch }), {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearCheckoutState() {
  const cookieStore = await cookies();
  cookieStore.delete(CHECKOUT_COOKIE);
}
