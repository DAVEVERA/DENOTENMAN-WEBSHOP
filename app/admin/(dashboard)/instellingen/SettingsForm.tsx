"use client";

import { useState } from "react";

export function SettingsForm({
  customerCode,
  customerNumber,
  collectionLocation,
  barcodeSerie,
  senderName,
  senderStreet,
  senderHouseNumber,
  senderPostalCode,
  senderCity,
  senderCountry,
}: {
  customerCode: string;
  customerNumber: string;
  collectionLocation: string;
  barcodeSerie: string;
  senderName: string;
  senderStreet: string;
  senderHouseNumber: string;
  senderPostalCode: string;
  senderCity: string;
  senderCountry: string;
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
          "postnl.senderName": form.get("senderName"),
          "postnl.senderStreet": form.get("senderStreet"),
          "postnl.senderHouseNumber": form.get("senderHouseNumber"),
          "postnl.senderPostalCode": form.get("senderPostalCode"),
          "postnl.senderCity": form.get("senderCity"),
          "postnl.senderCountry": form.get("senderCountry"),
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

      <div className="border-t border-border pt-4">
        <p className="font-heading text-body-sm font-bold text-text">Afzenderadres</p>
        <p className="mt-1 text-body-sm text-muted">
          Komt op het verzendlabel te staan als afzender.
        </p>
      </div>

      <div>
        <label htmlFor="senderName" className="block text-body-sm font-semibold text-text">
          Naam / bedrijfsnaam
        </label>
        <input
          id="senderName"
          name="senderName"
          type="text"
          defaultValue={senderName}
          className="mt-1 w-full rounded-button border border-border px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label htmlFor="senderStreet" className="block text-body-sm font-semibold text-text">
            Straatnaam
          </label>
          <input
            id="senderStreet"
            name="senderStreet"
            type="text"
            defaultValue={senderStreet}
            className="mt-1 w-full rounded-button border border-border px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="senderHouseNumber"
            className="block text-body-sm font-semibold text-text"
          >
            Huisnummer
          </label>
          <input
            id="senderHouseNumber"
            name="senderHouseNumber"
            type="text"
            defaultValue={senderHouseNumber}
            className="mt-1 w-24 rounded-button border border-border px-3 py-2"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="senderPostalCode"
            className="block text-body-sm font-semibold text-text"
          >
            Postcode
          </label>
          <input
            id="senderPostalCode"
            name="senderPostalCode"
            type="text"
            defaultValue={senderPostalCode}
            className="mt-1 w-full rounded-button border border-border px-3 py-2 font-mono"
          />
        </div>
        <div>
          <label htmlFor="senderCity" className="block text-body-sm font-semibold text-text">
            Plaats
          </label>
          <input
            id="senderCity"
            name="senderCity"
            type="text"
            defaultValue={senderCity}
            className="mt-1 w-full rounded-button border border-border px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label htmlFor="senderCountry" className="block text-body-sm font-semibold text-text">
          Land (ISO-code)
        </label>
        <input
          id="senderCountry"
          name="senderCountry"
          type="text"
          defaultValue={senderCountry}
          className="mt-1 w-24 rounded-button border border-border px-3 py-2 font-mono"
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
