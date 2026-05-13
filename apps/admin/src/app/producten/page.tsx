"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Spinner, Alert, AlertDescription } from "@denotenman/ui";
import type { Product } from "@denotenman/schemas";
import { adminApi } from "../../lib/admin-api";
import { StatusBadge } from "../../components/status-badge";

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function ProductenPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProducts = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.products.list(p);
      setProducts(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Producten konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts(page);
  }, [page, loadProducts]);

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(`Weet je zeker dat je "${product.name}" wilt verwijderen?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(product.id);
    try {
      await adminApi.products.remove(product.id);
      await loadProducts(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product kon niet worden verwijderd.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(total / 50);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Producten</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-neutral-500">
              {total} {total === 1 ? "product" : "producten"} in totaal
            </p>
          )}
        </div>
        <Button asChild size="sm">
          <Link href="/producten/nieuw">
            <Plus size={14} aria-hidden="true" />
            Nieuw product
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Producten laden..." />
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-neutral-500">Geen producten gevonden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">SKU</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Naam</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Categorie</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Varianten</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Aangemaakt</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-600">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-600">{product.sku}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{product.name}</td>
                    <td className="px-4 py-3 text-neutral-600">{product.category.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.status} type="product" />
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{product.variants.length}</td>
                    <td className="px-4 py-3 text-neutral-500">{formatDate(product.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            router.push(`/producten/${product.id}`);
                          }}
                          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-green"
                          aria-label={`${product.name} bewerken`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => {
                            void handleDelete(product);
                          }}
                          disabled={deletingId === product.id}
                          className="rounded p-1.5 text-neutral-500 hover:bg-danger-light hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`${product.name} verwijderen`}
                        >
                          {deletingId === product.id ? (
                            <Spinner size="sm" label="Verwijderen..." />
                          ) : (
                            <Trash2 size={14} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Pagina {page} van {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPage((p) => p - 1);
              }}
              disabled={!hasPrevPage}
              aria-label="Vorige pagina"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Vorige
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPage((p) => p + 1);
              }}
              disabled={!hasNextPage}
              aria-label="Volgende pagina"
            >
              Volgende
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
