"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCartItemInput } from "@denotenman/validation";
import { getCart, setCartItems, upsertCartItem } from "../lib/cart";
import { getProductBySlug } from "../lib/products";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getString(formData, key));
  if (!Number.isFinite(value)) throw new Error(`${key} is ongeldig.`);
  return value;
}

export type InlineCartState = {
  checkout: boolean;
  message: string;
  status: "idle" | "success" | "error";
};

async function addCartItemFromForm(formData: FormData) {
  const slug = getString(formData, "slug");
  const quantity = getNumber(formData, "quantity");
  const weightId = getString(formData, "weightId") || null;
  const variantId = getString(formData, "variantId") || null;
  const product = await getProductBySlug(slug);

  if (!product) throw new Error("Product niet gevonden.");

  const weight = weightId ? product.weights.find((item) => item.id === weightId) : product.weights[0];
  const variant = variantId
    ? product.variants.find((item) => item.variantId === variantId)
    : product.variants[0];
  const unitPrice = weight?.price ?? variant?.price ?? product.basePrice;

  validateCartItemInput({
    productId: product.id,
    variantId,
    quantity,
    unitPrice,
  });

  const cart = await getCart();
  const items = upsertCartItem(cart.items, {
    productId: product.id,
    variantId: variant?.variantId ?? variantId,
    weightId: weight?.id ?? weightId,
    weightLabel: weight?.label ?? null,
    slug: product.slug,
    image: product.image,
    name: product.name,
    quantity,
    unitPriceCents: Math.round(unitPrice * 100),
  });

  await setCartItems(items);
  revalidatePath("/", "layout");
  revalidatePath("/winkelwagen");
}

export async function addToCartAction(formData: FormData) {
  await addCartItemFromForm(formData);
  redirect("/winkelwagen");
}

export async function quickAddToCartAction(formData: FormData) {
  await addCartItemFromForm(formData);
}

export async function buyNowAction(formData: FormData) {
  await addCartItemFromForm(formData);
  redirect("/checkout");
}

export async function inlineAddToCartAction(
  _previousState: InlineCartState,
  formData: FormData,
): Promise<InlineCartState> {
  const intent = getString(formData, "intent");

  try {
    await addCartItemFromForm(formData);

    return {
      checkout: intent === "checkout",
      message:
        intent === "checkout"
          ? "Toegevoegd. Je kunt veilig verder naar afrekenen."
          : "Toegevoegd aan je winkelwagen.",
      status: "success",
    };
  } catch (error) {
    return {
      checkout: false,
      message: error instanceof Error ? error.message : "Toevoegen is niet gelukt.",
      status: "error",
    };
  }
}

export async function updateCartItemAction(formData: FormData) {
  const productId = getNumber(formData, "productId");
  const variantId = getString(formData, "variantId") || null;
  const weightId = getString(formData, "weightId") || null;
  const quantity = getNumber(formData, "quantity");
  const cart = await getCart();
  const items = cart.items
    .map((item) =>
      item.productId === productId &&
      (item.variantId ?? null) === variantId &&
      (item.weightId ?? null) === weightId
        ? { ...item, quantity }
        : item,
    )
    .filter((item) => item.quantity > 0);

  await setCartItems(items);
  revalidatePath("/", "layout");
  revalidatePath("/winkelwagen");
}

export async function removeCartItemAction(formData: FormData) {
  const productId = getNumber(formData, "productId");
  const variantId = getString(formData, "variantId") || null;
  const weightId = getString(formData, "weightId") || null;
  const cart = await getCart();
  const items = cart.items.filter(
    (item) =>
      !(
        item.productId === productId &&
        (item.variantId ?? null) === variantId &&
        (item.weightId ?? null) === weightId
      ),
  );

  await setCartItems(items);
  revalidatePath("/", "layout");
  revalidatePath("/winkelwagen");
}
