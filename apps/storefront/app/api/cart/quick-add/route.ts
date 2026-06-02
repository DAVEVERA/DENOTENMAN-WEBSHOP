import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validateCartItemInput } from "@denotenman/validation";
import { getCart, setCartItems, upsertCartItem } from "../../../../lib/cart";
import { getProductBySlug } from "../../../../lib/products";

type QuickAddPayload = {
  quantity?: number;
  slug?: string;
  variantId?: string | null;
  weightId?: string | null;
};

function getPositiveQuantity(value: unknown) {
  const quantity = Number(value ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as QuickAddPayload;
    const slug = payload.slug?.trim();

    if (!slug) {
      return NextResponse.json({ message: "Product ontbreekt." }, { status: 400 });
    }

    const product = await getProductBySlug(slug);

    if (!product) {
      return NextResponse.json({ message: "Product niet gevonden." }, { status: 404 });
    }

    const quantity = getPositiveQuantity(payload.quantity);
    const weightId = payload.weightId?.trim() || null;
    const variantId = payload.variantId?.trim() || null;
    const weight = weightId ? product.weights.find((item) => item.id === weightId) : product.weights[0];
    const variant = variantId ? product.variants.find((item) => item.variantId === variantId) : product.variants[0];
    const unitPrice = weight?.price ?? variant?.price ?? product.basePrice;

    validateCartItemInput({
      productId: product.id,
      quantity,
      unitPrice,
      variantId,
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

    return NextResponse.json({
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      message: "Toegevoegd aan je winkelwagen.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Toevoegen is niet gelukt." },
      { status: 500 },
    );
  }
}
