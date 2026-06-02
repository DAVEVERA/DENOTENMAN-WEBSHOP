"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { clientApi } from "./client-api";
import type { Cart } from "@denotenman/schemas";

export interface CartItem {
  lineId: string;
  variantId: string;
  quantity: number;
  productName: string;
  variantName: string;
  priceCents: number;
  imageUrl: string;
}

interface CartState {
  items: CartItem[];
  cartId: string | null;
  loading: boolean;
}

type CartAction =
  | { type: "SET_CART"; items: CartItem[]; cartId: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_CART":
      return { ...state, items: action.items, cartId: action.cartId, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "CLEAR":
      return { items: [], cartId: null, loading: false };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  cartId: string | null;
  loading: boolean;
  itemCount: number;
  subtotalCents: number;
  addItem: (params: {
    variantId: string;
    quantity: number;
    productName: string;
    variantName: string;
    priceCents: number;
    imageUrl: string;
  }) => Promise<void>;
  updateQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = "dnm_cart_items";
const CART_ID_KEY = "dnm_cart_id";

function persistCart(items: CartItem[], cartId: string | null): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    if (cartId) {localStorage.setItem(CART_ID_KEY, cartId);}
  } catch {
    // storage unavailable
  }
}

function loadPersistedCart(): { items: CartItem[]; cartId: string | null } {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const cartId = localStorage.getItem(CART_ID_KEY);
    const items: CartItem[] = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return { items, cartId };
  } catch {
    return { items: [], cartId: null };
  }
}

function cartToItems(cart: Cart, optimistic: CartItem[]): CartItem[] {
  return cart.lines.map((line) => {
    const existing =
      optimistic.find((i) => i.lineId === line.id) ??
      optimistic.find((i) => i.variantId === line.variantId);
    return {
      lineId: line.id,
      variantId: line.variantId,
      quantity: line.quantity,
      productName: existing?.productName ?? "",
      variantName: existing?.variantName ?? "",
      priceCents: existing?.priceCents ?? 0,
      imageUrl: existing?.imageUrl ?? "",
    };
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    cartId: null,
    loading: false,
  });

  useEffect(() => {
    const { items, cartId } = loadPersistedCart();
    if (items.length > 0 && cartId) {
      dispatch({ type: "SET_CART", items, cartId });
    }
  }, []);

  const syncWithApi = useCallback(
    async (
      optimisticItems: CartItem[],
      optimisticCartId: string | null,
      apiCall: () => Promise<Cart>,
    ) => {
      const prevItems = state.items;
      const prevCartId = state.cartId;
      if (optimisticCartId) {
        dispatch({ type: "SET_CART", items: optimisticItems, cartId: optimisticCartId });
        persistCart(optimisticItems, optimisticCartId);
      }
      try {
        const cart = await apiCall();
        const merged = cartToItems(cart, optimisticItems);
        dispatch({ type: "SET_CART", items: merged, cartId: cart.id });
        persistCart(merged, cart.id);
      } catch {
        dispatch({ type: "SET_CART", items: prevItems, cartId: prevCartId ?? "" });
        persistCart(prevItems, prevCartId);
        throw new Error("Toevoegen aan winkelwagen mislukt. Probeer het opnieuw.");
      }
    },
    [state.items, state.cartId],
  );

  const addItem = useCallback(
    async (params: {
      variantId: string;
      quantity: number;
      productName: string;
      variantName: string;
      priceCents: number;
      imageUrl: string;
    }) => {
      dispatch({ type: "SET_LOADING", loading: true });
      const existing = state.items.find((i) => i.variantId === params.variantId);
      const optimisticItems: CartItem[] = existing
        ? state.items.map((i) =>
            i.variantId === params.variantId ? { ...i, quantity: i.quantity + params.quantity } : i,
          )
        : [...state.items, { lineId: `optimistic-${params.variantId}`, ...params }];
      await syncWithApi(optimisticItems, state.cartId ?? "optimistic-cart", () =>
        clientApi.cart.addLine({ variantId: params.variantId, quantity: params.quantity }),
      );
      dispatch({ type: "SET_LOADING", loading: false });
    },
    [state.items, state.cartId, syncWithApi],
  );

  const updateQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      dispatch({ type: "SET_LOADING", loading: true });
      const optimisticItems = state.items.map((i) =>
        i.lineId === lineId ? { ...i, quantity } : i,
      );
      await syncWithApi(optimisticItems, state.cartId, () =>
        clientApi.cart.updateLine(lineId, { quantity }),
      );
      dispatch({ type: "SET_LOADING", loading: false });
    },
    [state.items, state.cartId, syncWithApi],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      dispatch({ type: "SET_LOADING", loading: true });
      const optimisticItems = state.items.filter((i) => i.lineId !== lineId);
      await syncWithApi(optimisticItems, state.cartId, () => clientApi.cart.removeLine(lineId));
      dispatch({ type: "SET_LOADING", loading: false });
    },
    [state.items, state.cartId, syncWithApi],
  );

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR" });
    persistCart([], null);
  }, []);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = state.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        cartId: state.cartId,
        loading: state.loading,
        itemCount,
        subtotalCents,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {throw new Error("useCart must be used within a CartProvider");}
  return ctx;
}
