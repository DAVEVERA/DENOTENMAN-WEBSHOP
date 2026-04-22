import { z } from "zod";
import {
  UserSchema,
  ProductSchema,
  CartSchema,
  OrderSchema,
  paginated,
  AddToCartSchema,
  UpdateCartLineSchema,
  LoginSchema,
  CreateOrderSchema,
} from "@denotenman/schemas";
import type {
  Product,
  Cart,
  Order,
  AddToCart,
  UpdateCartLine,
  Login,
  CreateOrder,
  Paginated,
} from "@denotenman/schemas";
import { request } from "./request.js";

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  getAccessToken?: () => Promise<string | null> | string | null;
}

const LoginResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
});

const RefreshResponseSchema = z.object({
  accessToken: z.string(),
});

const PaginatedProductSchema = paginated(ProductSchema);

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export function createApiClient(opts: ApiClientOptions) {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const { baseUrl, getAccessToken } = opts;

  function ctx(
    path: string,
    method: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ) {
    return {
      baseUrl,
      path,
      method,
      ...(body !== undefined ? { body } : {}),
      ...(query !== undefined ? { query } : {}),
      ...(getAccessToken !== undefined ? { getAccessToken } : {}),
      fetchImpl,
    };
  }

  return {
    auth: {
      login(body: Login): Promise<LoginResponse> {
        LoginSchema.parse(body);
        return request(LoginResponseSchema, ctx("/auth/login", "POST", body));
      },

      refresh(): Promise<RefreshResponse> {
        return request(RefreshResponseSchema, ctx("/auth/refresh", "POST"));
      },

      logout(): Promise<void> {
        return request(z.void(), ctx("/auth/logout", "POST"));
      },
    },

    products: {
      list(query?: Partial<{ page: number; pageSize: number }>): Promise<Paginated<Product>> {
        return request(
          PaginatedProductSchema,
          ctx("/products", "GET", undefined, query as Record<string, number | undefined>),
        );
      },

      getBySlug(slug: string): Promise<Product> {
        return request(ProductSchema, ctx(`/products/${encodeURIComponent(slug)}`, "GET"));
      },
    },

    cart: {
      get(): Promise<Cart> {
        return request(CartSchema, ctx("/cart", "GET"));
      },

      addLine(input: AddToCart): Promise<Cart> {
        AddToCartSchema.parse(input);
        return request(CartSchema, ctx("/cart/lines", "POST", input));
      },

      updateLine(id: string, input: UpdateCartLine): Promise<Cart> {
        UpdateCartLineSchema.parse(input);
        return request(CartSchema, ctx(`/cart/lines/${encodeURIComponent(id)}`, "PATCH", input));
      },

      removeLine(id: string): Promise<Cart> {
        return request(CartSchema, ctx(`/cart/lines/${encodeURIComponent(id)}`, "DELETE"));
      },
    },

    orders: {
      create(input: CreateOrder): Promise<Order> {
        CreateOrderSchema.parse(input);
        return request(OrderSchema, ctx("/orders", "POST", input));
      },

      getById(id: string): Promise<Order> {
        return request(OrderSchema, ctx(`/orders/${encodeURIComponent(id)}`, "GET"));
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
