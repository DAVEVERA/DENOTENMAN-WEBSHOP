"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PICKUP_LOCATIONS } from "@/lib/pickup-locations";

type Variant = { id: string; sku: string; label: string; stock: number; priceCents: number };
type Original = { id: string; orderNumber: string | null; contactName: string; contactEmail: string; deliveryMethod: string; shippingCity: string | null; pickupLocationId: string | null };
type Line = { variantId: string; quantity: number };

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 text-body-sm text-text";
const labelClass = "block text-body-sm font-semibold text-text";

export function OrderCreateForm({ original, variants }: { original: Original | null; variants: Variant[] }) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "", deliveryMethod: "SHIPPING", country: "NL", street: "", houseNumber: "", postalCode: "", city: "", pickupLocationId: "uden" });
  const [lines, setLines] = useState<Line[]>([{ variantId: "", quantity: 1 }]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof typeof contact>(key: K, value: (typeof contact)[K]) {
    setContact((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (lines.some((line) => !line.variantId) || new Set(lines.map((line) => line.variantId)).size !== lines.length) {
      setError("Kies voor iedere regel een ander product.");
      return;
    }
    if (original && !note.trim()) { setError("Geef de reden voor de nabestelling op."); return; }
    requestKey.current ??= crypto.randomUUID();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: original ? "REPLACEMENT" : "MANUAL", originalOrderId: original?.id, contact: original ? undefined : contact, items: lines, note, requestKey: requestKey.current }),
      });
      const body = await response.json().catch(() => null) as { id?: string; error?: string; message?: string } | null;
      if (!response.ok || !body?.id) throw new Error(body?.message || body?.error || "De bestelling kon niet worden opgeslagen.");
      router.push(`/admin/bestellingen/${body.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "De bestelling kon niet worden opgeslagen.");
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 grid gap-6 rounded-panel border border-border bg-surface p-5 shadow-card">
    {original ? <div className="rounded-card bg-background p-4 text-body-sm">
      <p className="font-bold">Oorspronkelijke bestelling: {original.orderNumber ?? original.id}</p>
      <p>{original.contactName} · {original.contactEmail}</p>
      <p>{original.deliveryMethod === "PICKUP" ? `Afhalen: ${original.pickupLocationId ?? "onbekend"}` : `Verzenden naar: ${original.shippingCity ?? "onbekend"}`}</p>
    </div> : <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 font-heading text-heading-sm">Klant en bezorging</legend>
      <label className={labelClass}>Naam<input required value={contact.name} onChange={(event) => setField("name", event.target.value)} className={inputClass} /></label>
      <label className={labelClass}>E-mailadres<input required type="email" value={contact.email} onChange={(event) => setField("email", event.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Telefoon<input value={contact.phone} onChange={(event) => setField("phone", event.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Land<select value={contact.country} onChange={(event) => setContact((current) => ({ ...current, country: event.target.value, pickupLocationId: event.target.value === "BE" ? "antwerpen" : "uden" }))} className={inputClass}><option value="NL">Nederland</option><option value="BE">België</option></select></label>
      <label className={labelClass}>Levering<select value={contact.deliveryMethod} onChange={(event) => setField("deliveryMethod", event.target.value)} className={inputClass}><option value="SHIPPING">Verzenden</option><option value="PICKUP">Gratis afhalen op de markt</option></select></label>
      {contact.deliveryMethod === "PICKUP" ? <label className={labelClass}>Markt<select value={contact.pickupLocationId} onChange={(event) => setField("pickupLocationId", event.target.value)} className={inputClass}>{PICKUP_LOCATIONS.filter((location) => location.country === contact.country).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label> : <>
        <label className={labelClass}>Straat<input required value={contact.street} onChange={(event) => setField("street", event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Huisnummer<input required value={contact.houseNumber} onChange={(event) => setField("houseNumber", event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Postcode<input required value={contact.postalCode} onChange={(event) => setField("postalCode", event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Plaats<input required value={contact.city} onChange={(event) => setField("city", event.target.value)} className={inputClass} /></label>
      </>}
    </fieldset>}
    <fieldset className="grid gap-3">
      <legend className="font-heading text-heading-sm">Producten</legend>
      {lines.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
        <label className={labelClass}>Product {index + 1}<select required value={line.variantId} onChange={(event) => setLines((current) => current.map((item, position) => position === index ? { ...item, variantId: event.target.value } : item))} className={inputClass}>
          <option value="">Kies een product</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label} · € {(variant.priceCents / 100).toFixed(2).replace(".", ",")} · voorraad {variant.stock}</option>)}
        </select></label>
        <label className={labelClass}>Aantal<input type="number" min={1} max={100} required value={line.quantity} onChange={(event) => setLines((current) => current.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item))} className={inputClass} /></label>
        <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, position) => position !== index))} className="min-h-11 self-end rounded-button border border-border px-3 text-body-sm disabled:opacity-50">Verwijder</button>
      </div>)}
      <button type="button" onClick={() => setLines((current) => [...current, { variantId: "", quantity: 1 }])} className="min-h-11 justify-self-start rounded-button border border-border px-4 text-body-sm font-semibold">Product toevoegen</button>
    </fieldset>
    <label className={labelClass}>{original ? "Reden voor nabestelling" : "Interne notitie (optioneel)"}<textarea required={Boolean(original)} value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} className={`${inputClass} py-2`} /></label>
    <p className="text-body-sm text-muted">{original ? "Klant betaalt € 0,00. Ook de extra verzending is voor De Notenman." : "Productprijzen en verzendkosten worden bij het opslaan opnieuw berekend. De bestelling blijft open tot een externe betaling is bevestigd."}</p>
    {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
    <button type="submit" disabled={saving} className="min-h-12 justify-self-start rounded-button bg-accent px-5 font-heading font-bold text-contrast disabled:opacity-50">{saving ? "Opslaan…" : original ? "Nabestelling aanmaken" : "Handmatige bestelling aanmaken"}</button>
  </form>;
}
