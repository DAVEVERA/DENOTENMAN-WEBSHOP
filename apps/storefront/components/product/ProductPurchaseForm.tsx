"use client";

import { useActionState } from "react";
import { inlineAddToCartAction, type InlineCartState } from "../../actions/cart.actions";
import type { StorefrontProductDetail } from "../../lib/products";
import { formatPrice } from "../../lib/products";
import { Icon } from "../ui/Icon";

type ProductPurchaseFormProps = {
  product: StorefrontProductDetail;
};

const initialState: InlineCartState = {
  checkout: false,
  message: "",
  status: "idle",
};

function getUnitPriceLabel(product: StorefrontProductDetail) {
  const firstWeight = product.weights[0];
  const firstVariant = product.variants[0];
  return formatPrice(firstWeight?.price ?? firstVariant?.price ?? product.basePrice);
}

function getWeightIcon(index: number, total: number) {
  if (total <= 1) return "Small_bowl";
  if (index === 0) return "Small_bowl";
  if (index === total - 1) return "bucket";
  return "medium_bag";
}

export function ProductPurchaseForm({ product }: ProductPurchaseFormProps) {
  const [state, formAction, isPending] = useActionState(inlineAddToCartAction, initialState);
  const defaultWeight = product.weights[0];
  const defaultVariant = product.variants[0];

  return (
    <form className="product-buybox" action={formAction}>
      <input type="hidden" name="slug" value={product.slug} />
      {defaultVariant && <input type="hidden" name="variantId" value={defaultVariant.variantId} />}

      {product.weights.length > 0 && (
        <fieldset className="product-unit-tiles">
          <legend>Besteleenheid</legend>
          {product.weights.map((weight, index) => (
            <label key={weight.id} className="product-unit-tile">
              <input
                type="radio"
                name="weightId"
                value={weight.id}
                defaultChecked={weight.id === defaultWeight?.id}
              />
              <span>
                <Icon name={getWeightIcon(index, product.weights.length)} />
                <strong>{weight.label}</strong>
                <small>{formatPrice(weight.price)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <label className="form-field product-quantity-field">
        <span>Aantal</span>
        <input type="number" name="quantity" defaultValue={1} min={1} />
      </label>

      <div className="product-buybox__ctas">
        <button
          className="button button--primary"
          type="submit"
          name="intent"
          value="cart"
          disabled={isPending}
        >
          <Icon name="shopping-basket" />
          In winkelwagen
        </button>
        <button
          className="button button--secondary"
          type="submit"
          name="intent"
          value="checkout"
          disabled={isPending}
        >
          <Icon name="checkout" />
          Gelijk bestellen
        </button>
      </div>

      {state.status !== "idle" && (
        <div className={`product-buybox__notice product-buybox__notice--${state.status}`} role="status">
          <span>{state.message}</span>
          {state.status === "success" && (
            <a href={state.checkout ? "/checkout" : "/winkelwagen"}>
              {state.checkout ? "Naar afrekenen" : "Bekijk winkelwagen"}
            </a>
          )}
        </div>
      )}

      <div className="product-mobile-cta" aria-label="Mobiele bestelactie">
        <span>{getUnitPriceLabel(product)}</span>
        <button type="submit" name="intent" value="cart" disabled={isPending}>
          <Icon name="shopping-basket" />
          In winkelwagen
        </button>
      </div>
    </form>
  );
}
