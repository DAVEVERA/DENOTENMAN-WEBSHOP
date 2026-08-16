"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

type SaveState = "idle" | "saving" | "error";

type LineItem = {
  key: string;
  productName: string;
  quantity: string;
  unitPriceEuro: string;
};

function emptyLineItem(key: string): LineItem {
  return { key, productName: "", quantity: "1", unitPriceEuro: "0.00" };
}

export function QuoteCreateForm({ businessAccountId }: { businessAccountId: string }) {
  const router = useRouter();
  const baseId = useId();

  const [items, setItems] = useState<LineItem[]>([emptyLineItem(`${baseId}-0`)]);
  const [validUntil, setValidUntil] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalCents = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity);
      const price = Number(item.unitPriceEuro);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
      return sum + Math.round(price * 100) * qty;
    }, 0);
  }, [items]);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => [...current, emptyLineItem(`${baseId}-${current.length}-${Date.now()}`)]);
  }

  function removeItem(key: string) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedItems: { productName: string; quantity: number; unitPriceCents: number }[] = [];
    for (const item of items) {
      const productName = item.productName.trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPriceEuro);

      if (productName.length === 0) {
        setState("error");
        setErrorMessage("Elke regel moet een productnaam hebben.");
        return;
      }
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
        setState("error");
        setErrorMessage("Aantal moet een geheel getal van minimaal 1 zijn.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setState("error");
        setErrorMessage("Prijs per stuk moet 0 of hoger zijn.");
        return;
      }

      parsedItems.push({
        productName,
        quantity,
        unitPriceCents: Math.round(unitPrice * 100),
      });
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/business-accounts/${businessAccountId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: parsedItems,
          validUntil: validUntil.length > 0 ? new Date(validUntil).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setState("error");
        setErrorMessage(errorMessageFor(data?.error));
        return;
      }

      router.push(`/admin/zakelijk/${businessAccountId}`);
      router.refresh();
    } catch {
      setState("error");
      setErrorMessage("Opslaan mislukt door een netwerkfout. Probeer het opnieuw.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-panel border border-border bg-surface p-6 shadow-card">
      <div className="space-y-4">
        <span className="font-heading text-body-sm font-semibold text-text">Regels</span>

        <div className="overflow-x-auto rounded-panel border border-border">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border bg-background text-left text-muted">
                <th className="px-3 py-2 font-heading">Product</th>
                <th className="px-3 py-2 font-heading">Aantal</th>
                <th className="px-3 py-2 font-heading">Prijs per stuk</th>
                <th className="px-3 py-2 text-right font-heading">Regeltotaal</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qty = Number(item.quantity);
                const price = Number(item.unitPriceEuro);
                const lineTotal =
                  Number.isFinite(qty) && Number.isFinite(price) ? Math.round(price * 100) * qty : 0;

                return (
                  <tr key={item.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(event) => updateItem(item.key, { productName: event.target.value })}
                        placeholder="Bijv. Gemengde noten 1kg"
                        required
                        className="w-full min-w-[10rem] rounded-button border border-border bg-background px-2 py-1.5 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity}
                        onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                        required
                        className="w-20 rounded-button border border-border bg-background px-2 py-1.5 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-muted">€</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPriceEuro}
                          onChange={(event) => updateItem(item.key, { unitPriceEuro: event.target.value })}
                          required
                          className="w-24 rounded-button border border-border bg-background px-2 py-1.5 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-text">{formatPrice(lineTotal, "nl")}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        disabled={items.length === 1}
                        className="font-heading text-body-sm font-semibold text-red-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Verwijder
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addItem}
          className="rounded-button border border-border bg-background px-3 py-2 font-heading text-body-sm font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover"
        >
          + Regel toevoegen
        </button>

        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-body-sm text-muted">Totaal</p>
            <p className="font-heading text-heading-sm font-semibold text-text">
              {formatPrice(totalCents, "nl")}
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label htmlFor="quote-valid-until" className="font-heading text-body-sm font-semibold text-text">
            Geldig tot
          </label>
          <input
            id="quote-valid-until"
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Opslaan…" : "Offerte aanmaken"}
        </button>

        {state === "error" ? (
          <span className="text-body-sm font-semibold text-red-700">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}

function errorMessageFor(code: string | undefined): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "Controleer de ingevulde regels.";
    case "INVALID_VALID_UNTIL":
      return "Geldig-tot datum is ongeldig.";
    case "NOT_FOUND":
      return "Zakelijk account niet gevonden.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}
