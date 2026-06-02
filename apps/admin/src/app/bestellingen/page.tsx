"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Spinner, Alert, AlertDescription } from "@denotenman/ui";
import type { Order } from "@denotenman/schemas";
import { adminApi } from "../../lib/admin-api";
import { StatusBadge } from "../../components/status-badge";

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function klantLabel(order: Order): string {
  if (order.guestEmail) {
    return order.guestEmail;
  }
  if (order.customerId) {
    return `Klant #${order.customerId.slice(0, 8)}`;
  }
  return "Onbekend";
}

export default function BestellingenPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.orders.list(p);
      setOrders(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bestellingen konden niet worden geladen.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(page);
  }, [page, loadOrders]);

  const totalPages = Math.ceil(total / 50);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Bestellingen</h1>
        {!isLoading && (
          <p className="mt-1 text-sm text-neutral-500">
            {total} {total === 1 ? "bestelling" : "bestellingen"} in totaal
          </p>
        )}
      </div>

      {error && (
        <Alert variant="danger" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Bestellingen laden..." />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-neutral-500">Geen bestellingen gevonden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Bestelnummer</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Klant</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-600">Bedrag</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => {
                      router.push(`/bestellingen/${order.id}`);
                    }}
                    className="cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-neutral-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{klantLabel(order)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} type="order" />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-neutral-900">
                      {formatEuro(order.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{formatDate(order.createdAt)}</td>
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
