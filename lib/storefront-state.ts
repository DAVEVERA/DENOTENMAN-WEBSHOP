"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";

const storageKey = "denotenman-storefront-v1";
const changeEvent = "denotenman-storefront-change";

export type FavoriteItem = {
  productId: string;
  slug: string;
  name: string;
  basePriceCents: number;
  imageUrl: string | null;
  locale: Locale;
};

export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  /** Optional only for carts saved before weight-aware shipping was released. */
  weightGrams?: number;
  priceCents: number;
  quantity: number;
  imageUrl: string | null;
  locale: Locale;
};

type StorefrontState = {
  favorites: FavoriteItem[];
  cart: CartItem[];
};

const emptyState: StorefrontState = { favorites: [], cart: [] };
let state = emptyState;
let loaded = false;

function isStorefrontState(value: unknown): value is StorefrontState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StorefrontState>;
  return Array.isArray(candidate.favorites) && Array.isArray(candidate.cart);
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed: unknown = JSON.parse(stored);
    if (isStorefrontState(parsed)) state = parsed;
  } catch {
    state = emptyState;
  }
}

function emit(next: StorefrontState) {
  state = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Keep the in-memory store usable when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(listener: () => void) {
  ensureLoaded();
  function handleStorage(event: StorageEvent) {
    if (event.key !== storageKey) return;
    loaded = false;
    ensureLoaded();
    listener();
  }
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot() {
  ensureLoaded();
  return state;
}

export function useStorefrontState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => emptyState);
}

export function toggleFavorite(item: FavoriteItem): boolean {
  ensureLoaded();
  const exists = state.favorites.some((favorite) => favorite.productId === item.productId);
  emit({
    ...state,
    favorites: exists
      ? state.favorites.filter((favorite) => favorite.productId !== item.productId)
      : [item, ...state.favorites],
  });
  return !exists;
}

export function addCartItem(item: Omit<CartItem, "quantity">, quantity = 1) {
  ensureLoaded();
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const existing = state.cart.find((entry) => entry.variantId === item.variantId);
  const cart = existing
    ? state.cart.map((entry) =>
        entry.variantId === item.variantId
          ? { ...entry, quantity: entry.quantity + safeQuantity }
          : entry
      )
    : [...state.cart, { ...item, quantity: safeQuantity }];
  emit({ ...state, cart });
}

export function updateCartQuantity(variantId: string, quantity: number) {
  ensureLoaded();
  const safeQuantity = Math.floor(quantity);
  emit({
    ...state,
    cart:
      safeQuantity <= 0
        ? state.cart.filter((item) => item.variantId !== variantId)
        : state.cart.map((item) =>
            item.variantId === variantId ? { ...item, quantity: safeQuantity } : item
          ),
  });
}

export function removeCartItem(variantId: string) {
  ensureLoaded();
  emit({ ...state, cart: state.cart.filter((item) => item.variantId !== variantId) });
}

export function clearCart() {
  ensureLoaded();
  emit({ ...state, cart: [] });
}
