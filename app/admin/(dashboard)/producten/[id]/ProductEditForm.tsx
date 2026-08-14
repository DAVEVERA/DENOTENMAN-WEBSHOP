"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VariantData = {
  id: string;
  sku: string;
  label: string | null;
  weightGrams: number;
  preparation: string;
  salting: string;
  coating: string;
  isActive: boolean;
  priceCents: number;
  stock: number;
};

type ImageData = {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
};

type Props = {
  productId: string;
  basePriceCents: number;
  unit: "WEIGHT" | "VOLUME";
  isActive: boolean;
  name: string;
  description: string;
  hasNlTranslation: boolean;
  variants: VariantData[];
  images: ImageData[];
};

type VariantEdit = { priceEuro: string; stock: string };

const preparationLabels: Record<string, string> = {
  RAW: "Rauw",
  ROASTED: "Gebrand",
};

const saltingLabels: Record<string, string> = {
  UNSALTED: "Ongezouten",
  SALTED: "Gezouten",
};

const coatingLabels: Record<string, string> = {
  NONE: "Geen",
  CHOCOLATE: "Chocolade",
  YOGHURT: "Yoghurt",
  FLAVORED: "Gearomatiseerd",
};

const errorMessages: Record<string, string> = {
  UNAUTHORIZED: "Je sessie is verlopen. Log opnieuw in.",
  NOT_FOUND: "Dit product bestaat niet meer.",
  VALIDATION_ERROR: "Controleer de ingevoerde gegevens.",
  VARIANT_NOT_FOUND: "Een variant kon niet worden gevonden op dit product.",
  TRANSLATION_NOT_FOUND: "Dit product heeft geen Nederlandse vertaling om bij te werken.",
  INVALID_BODY: "Er ging iets mis bij het versturen van de gegevens.",
  INTERNAL_ERROR: "Er ging iets mis. Probeer het opnieuw.",
};

function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function euroInputToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Math.round(parseFloat(normalized) * 100);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function stockInputToInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function ProductEditForm({
  productId,
  basePriceCents,
  unit,
  isActive: initialIsActive,
  name: initialName,
  description: initialDescription,
  hasNlTranslation,
  variants,
  images,
}: Props) {
  const router = useRouter();
  const [basePriceEuro, setBasePriceEuro] = useState(centsToEuroInput(basePriceCents));
  const [isActive, setIsActive] = useState(initialIsActive);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantEdit>>(() =>
    Object.fromEntries(
      variants.map((variant) => [
        variant.id,
        { priceEuro: centsToEuroInput(variant.priceCents), stock: String(variant.stock) },
      ])
    )
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateVariant(id: string, field: keyof VariantEdit, value: string) {
    setStatus("idle");
    setVariantEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const basePriceCentsValue = euroInputToCents(basePriceEuro);
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (basePriceCentsValue === null) {
      setStatus("error");
      setErrorMessage("Basisprijs moet een geldig bedrag zijn (bijv. 12,50).");
      return;
    }
    if (!trimmedName) {
      setStatus("error");
      setErrorMessage("Productnaam mag niet leeg zijn.");
      return;
    }
    if (!trimmedDescription) {
      setStatus("error");
      setErrorMessage("Omschrijving mag niet leeg zijn.");
      return;
    }

    const variantPayload: { id: string; priceCents: number; stock: number }[] = [];
    for (const variant of variants) {
      const edit = variantEdits[variant.id];
      const priceCents = euroInputToCents(edit?.priceEuro ?? "");
      const stock = stockInputToInt(edit?.stock ?? "");
      if (priceCents === null || stock === null) {
        setStatus("error");
        setErrorMessage(`Ongeldige prijs of voorraad voor variant ${variant.sku}.`);
        return;
      }
      variantPayload.push({ id: variant.id, priceCents, stock });
    }

    setStatus("saving");

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePriceCents: basePriceCentsValue,
          isActive,
          translation: { name: trimmedName, description: trimmedDescription },
          variants: variantPayload,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        const code = typeof data?.error === "string" ? data.error : "INTERNAL_ERROR";
        setStatus("error");
        setErrorMessage(errorMessages[code] ?? errorMessages.INTERNAL_ERROR);
        return;
      }

      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage("Er ging iets mis. Probeer het opnieuw.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-panel border border-border bg-surface p-6 shadow-card">
        <h2 className="text-heading-md text-text">Product</h2>
        {!hasNlTranslation ? (
          <p className="mt-2 text-body-sm text-red-600">
            Let op: er is nog geen Nederlandse vertaling voor dit product. Opslaan lukt pas
            wanneer die bestaat.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-body-sm font-semibold text-text">
              Naam (NL)
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => {
                setStatus("idle");
                setName(event.target.value);
              }}
              className="mt-1 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="basePrice" className="block text-body-sm font-semibold text-text">
              Basisprijs (€)
            </label>
            <input
              id="basePrice"
              inputMode="decimal"
              value={basePriceEuro}
              onChange={(event) => {
                setStatus("idle");
                setBasePriceEuro(event.target.value);
              }}
              className="mt-1 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="description" className="block text-body-sm font-semibold text-text">
            Omschrijving (NL)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => {
              setStatus("idle");
              setDescription(event.target.value);
            }}
            rows={5}
            className="mt-1 w-full rounded-button border border-border px-3 py-2"
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-body-sm font-semibold text-text">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => {
              setStatus("idle");
              setIsActive(event.target.checked);
            }}
            className="h-4 w-4 rounded border-border"
          />
          Product is actief (zichtbaar in de webshop)
        </label>
      </section>

      <section className="rounded-panel border border-border bg-surface p-6 shadow-card">
        <h2 className="text-heading-md text-text">Varianten</h2>

        {variants.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted">Dit product heeft geen varianten.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-3 py-2 font-heading">SKU</th>
                  <th className="px-3 py-2 font-heading">Gewicht</th>
                  <th className="px-3 py-2 font-heading">Bereiding</th>
                  <th className="px-3 py-2 font-heading">Zout</th>
                  <th className="px-3 py-2 font-heading">Coating</th>
                  <th className="px-3 py-2 font-heading">Status</th>
                  <th className="px-3 py-2 font-heading">Prijs (€)</th>
                  <th className="px-3 py-2 font-heading">Voorraad</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text">
                      <span className="font-mono">{variant.sku}</span>
                      {variant.label ? (
                        <span className="block text-xs text-muted">{variant.label}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-text">
                      {variant.weightGrams} {unit === "VOLUME" ? "ml" : "g"}
                    </td>
                    <td className="px-3 py-2 text-text">
                      {preparationLabels[variant.preparation] ?? variant.preparation}
                    </td>
                    <td className="px-3 py-2 text-text">
                      {saltingLabels[variant.salting] ?? variant.salting}
                    </td>
                    <td className="px-3 py-2 text-text">
                      {coatingLabels[variant.coating] ?? variant.coating}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          variant.isActive
                            ? "inline-flex items-center rounded-button bg-accent/10 px-2 py-1 text-xs font-semibold text-accent-hover"
                            : "inline-flex items-center rounded-button bg-border px-2 py-1 text-xs font-semibold text-muted"
                        }
                      >
                        {variant.isActive ? "Actief" : "Inactief"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={variantEdits[variant.id]?.priceEuro ?? ""}
                        onChange={(event) => updateVariant(variant.id, "priceEuro", event.target.value)}
                        className="w-24 rounded-button border border-border px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        value={variantEdits[variant.id]?.stock ?? ""}
                        onChange={(event) => updateVariant(variant.id, "stock", event.target.value)}
                        className="w-20 rounded-button border border-border px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-border bg-surface p-6 shadow-card">
        <h2 className="text-heading-md text-text">Afbeeldingen</h2>
        {images.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted">Geen afbeeldingen voor dit product.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-4">
            {images.map((image) => (
              <div key={image.id} className="w-28">
                <img
                  src={image.url}
                  alt={image.alt ?? ""}
                  className="h-28 w-28 rounded-button border border-border object-cover"
                />
                {image.isPrimary ? (
                  <span className="mt-1 block text-center text-xs font-semibold text-accent-hover">
                    Primair
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-md font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:opacity-60"
        >
          {status === "saving" ? "Bezig met opslaan…" : "Opslaan"}
        </button>
        {status === "saved" ? (
          <p className="text-body-sm font-semibold text-accent-hover">Opgeslagen.</p>
        ) : null}
        {status === "error" && errorMessage ? (
          <p className="text-body-sm text-red-600">{errorMessage}</p>
        ) : null}
      </div>
    </form>
  );
}
