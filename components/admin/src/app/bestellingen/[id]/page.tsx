"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button, Spinner, Alert, AlertDescription, Select } from "@denotenman/ui";
import type { Order } from "@denotenman/schemas";
import { adminApi } from "../../../lib/admin-api";
import { StatusBadge } from "../../../components/status-badge";

interface BestellingDetailPageProps {
  params: { id: string };
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

const orderStatuses = [
  { value: "pending", label: "In behandeling" },
  { value: "paid", label: "Betaald" },
  { value: "fulfilled", label: "Verzonden" },
  { value: "cancelled", label: "Geannuleerd" },
  { value: "refunded", label: "Terugbetaald" },
] as const;

export default function BestellingDetailPage({ params }: BestellingDetailPageProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await adminApi.orders.list(1);
        const found = result.items.find((o) => o.id === params.id);
        if (!found) {
          setError("Bestelling niet gevonden.");
        } else {
          setOrder(found);
          setSelectedStatus(found.status);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bestelling kon niet worden geladen.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [params.id]);

  async function handleStatusUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) {
      return;
    }

    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const updated = await adminApi.orders.updateStatus(order.id, selectedStatus);
      setOrder(updated);
      setSelectedStatus(updated.status);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Status kon niet worden opgeslagen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5 sm:mb-6">
        {/* Terugknop: min 44px hoog voor touch */}
        <Link
          href="/bestellingen"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Terug naar bestellingen
        </Link>
        <h1 className="mt-2 text-xl font-bold text-neutral-900 sm:text-2xl">
          {order ? `Bestelling ${order.orderNumber}` : "Bestelling"}
        </h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Bestelling laden..." />
        </div>
      )}

      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {order && (
        <div className="space-y-4">
          {/* Overzicht: kleinere padding op mobile */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="text-base font-semibold text-neutral-900">Overzicht</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:gap-x-6">
              <div>
                <dt className="font-medium text-neutral-600">Bestelnummer</dt>
                <dd className="mt-1 font-mono text-neutral-900 break-all">{order.orderNumber}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={order.status} type="order" />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">Klant</dt>
                <dd className="mt-1 break-all text-neutral-900">{klantLabel(order)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">Datum</dt>
                <dd className="mt-1 text-neutral-900">{formatDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">Subtotaal</dt>
                <dd className="mt-1 text-neutral-900">{formatEuro(order.subtotalCents)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">Verzendkosten</dt>
                <dd className="mt-1 text-neutral-900">{formatEuro(order.shippingCents)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">BTW</dt>
                <dd className="mt-1 text-neutral-900">{formatEuro(order.taxCents)}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-600">Totaal</dt>
                <dd className="mt-1 text-lg font-bold text-neutral-900">
                  {formatEuro(order.totalCents)}
                </dd>
              </div>
            </dl>
          </div>

          {order.lines.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-4 py-3 sm:px-6 sm:py-4">
                <h2 className="text-base font-semibold text-neutral-900">Orderregels</h2>
              </div>
              {/* Horizontaal scrollbaar op small screens */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50">
                      <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-neutral-600">
                        Product
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-neutral-600">
                        Variant
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-600">
                        Aantal
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-600">
                        Stukprijs
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-600">
                        Totaal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {order.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-neutral-900">{line.productName}</td>
                        <td className="px-4 py-3 text-neutral-600">{line.variantName}</td>
                        <td className="px-4 py-3 text-right text-neutral-900">{line.quantity}</td>
                        <td className="px-4 py-3 text-right text-neutral-900">
                          {formatEuro(line.unitPriceCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-neutral-900">
                          {formatEuro(line.totalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="text-base font-semibold text-neutral-900">Status bijwerken</h2>

            {saveSuccess && (
              <Alert variant="success" className="mt-3">
                <AlertDescription>Status succesvol bijgewerkt.</AlertDescription>
              </Alert>
            )}

            {saveError && (
              <Alert variant="danger" className="mt-3">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            {/* Op mobile: gestapeld; op sm+: naast elkaar */}
            <form
              onSubmit={(e) => {
                void handleStatusUpdate(e);
              }}
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <Select
                label="Nieuwe status"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setSaveSuccess(false);
                }}
                containerClassName="w-full sm:flex-1 sm:max-w-xs"
              >
                {orderStatuses.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button
                type="submit"
                disabled={isSaving || selectedStatus === order.status}
                loading={isSaving}
                className="w-full sm:w-auto"
              >
                Opslaan
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
