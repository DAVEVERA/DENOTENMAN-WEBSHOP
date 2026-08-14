"use client";

import { useState } from "react";

export function SettingsForm({
  customerCode,
  customerNumber,
  collectionLocation,
  barcodeSerie,
}: {
  customerCode: string;
  customerNumber: string;
  collectionLocation: string;
  barcodeSerie: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "postnl.customerCode": form.get("customerCode"),
          "postnl.customerNumber": form.get("customerNumber"),
          "postnl.collectionLocation": form.get("collectionLocation"),
          "postnl.barcodeSerie": form.get("barcodeSerie"),
        }),
      });

      setStatus(response.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-panel border border-border bg-surface p-5"
      noValidate
    >
      <div>
        <label htmlFor="customerCode" className="block text-body-sm font-semibold text-text">
          CustomerCode
        </label>
        <input
          id="customerCode"
          name="customerCode"
          type="text"
          defaultValue={customerCode}
          className="mt-1 w-full rounded-button border border-border px-3 py-2 font-mono"
        />
      </div>
      <div>
        <label htmlFor="customerNumber" className="block text-body-sm font-semibold text-text">
          CustomerNumber
        </label>
        <input
          id="customerNumber"
          name="customerNumber"
          type="text"
          defaultValue={customerNumber}
          className="mt-1 w-full rounded-button border border-border px-3 py-2 font-mono"
        />
      </div>
      <div>
        <label
          htmlFor="collectionLocation"
          className="block text-body-sm font-semibold text-text"
        >
          CollectionLocation
        </label>
        <input
          id="collectionLocation"
          name="collectionLocation"
          type="text"
          defaultValue={collectionLocation}
          className="mt-1 w-full rounded-button border border-border px-3 py-2 font-mono"
        />
      </div>
      <div>
        <label htmlFor="barcodeSerie" className="block text-body-sm font-semibold text-text">
          Barcode serie
        </label>
        <input
          id="barcodeSerie"
          name="barcodeSerie"
          type="text"
          defaultValue={barcodeSerie}
          className="mt-1 w-full rounded-button border border-border px-3 py-2 font-mono"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-md font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:opacity-60"
        >
          {status === "saving" ? "Bezig..." : "Opslaan"}
        </button>
        {status === "saved" ? (
          <span className="text-body-sm text-[#69B53D]">Opgeslagen.</span>
        ) : null}
        {status === "error" ? (
          <span className="text-body-sm text-red-600">Opslaan mislukt.</span>
        ) : null}
      </div>
    </form>
  );
}
