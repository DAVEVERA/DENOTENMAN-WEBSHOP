import type { Product, Order, CategoryTree } from "@denotenman/schemas";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  revenueThisMonth: number;
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface ApiErrorBody {
  error?: { message?: string };
}

async function apiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("dnm_access_token") : null;

  const res = await fetch(`${BASE}/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  stats: () => apiFetch<AdminStats>("/admin/stats"),

  products: {
    list: (page = 1) =>
      apiFetch<PaginatedResponse<Product>>(`/products?pageSize=50&page=${page}&status=all`),
    create: (data: unknown) =>
      apiFetch<Product>("/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: unknown) =>
      apiFetch<Product>(`/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: string) => apiFetch<undefined>(`/products/${id}`, { method: "DELETE" }),
    addVariant: (id: string, data: unknown) =>
      apiFetch<unknown>(`/products/${id}/variants`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateVariant: (id: string, variantId: string, data: unknown) =>
      apiFetch<unknown>(`/products/${id}/variants/${variantId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removeVariant: (id: string, variantId: string) =>
      apiFetch<undefined>(`/products/${id}/variants/${variantId}`, {
        method: "DELETE",
      }),
  },

  categories: {
    list: () => apiFetch<CategoryTree[]>("/categories"),
    create: (data: unknown) =>
      apiFetch<unknown>("/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: unknown) =>
      apiFetch<unknown>(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: string) => apiFetch<undefined>(`/categories/${id}`, { method: "DELETE" }),
  },

  orders: {
    list: (page = 1) => apiFetch<PaginatedResponse<Order>>(`/orders?pageSize=50&page=${page}`),
    updateStatus: (id: string, status: string) =>
      apiFetch<Order>(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },
};
