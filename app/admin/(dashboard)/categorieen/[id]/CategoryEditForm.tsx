"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type CategoryFormData = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
};

type ParentOption = {
  id: string;
  name: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const NO_PARENT_VALUE = "__none__";

export function CategoryEditForm({
  category,
  parentOptions,
}: {
  category: CategoryFormData;
  parentOptions: ParentOption[];
}) {
  const router = useRouter();

  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [isActive, setIsActive] = useState(category.isActive);
  const [parentId, setParentId] = useState(category.parentId ?? NO_PARENT_VALUE);

  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setState("error");
      setErrorMessage("Naam mag niet leeg zijn.");
      return;
    }

    const parsedSortOrder = Number(sortOrder);
    if (!Number.isFinite(parsedSortOrder) || !Number.isInteger(parsedSortOrder)) {
      setState("error");
      setErrorMessage("Sortering moet een geheel getal zijn.");
      return;
    }

    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim().length > 0 ? description.trim() : null,
          sortOrder: parsedSortOrder,
          isActive,
          parentId: parentId === NO_PARENT_VALUE ? null : parentId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setState("error");
        setErrorMessage(errorMessageFor(data?.error));
        return;
      }

      const data = (await response.json().catch(() => null)) as {
        frontendSynced?: boolean;
      } | null;
      if (data?.frontendSynced === false) {
        setState("error");
        setErrorMessage(
          "De categorie is opgeslagen, maar de webshop kon niet direct worden vernieuwd. Sla opnieuw op om de synchronisatie te herhalen."
        );
        router.refresh();
        return;
      }

      setState("saved");
      router.refresh();
    } catch {
      setState("error");
      setErrorMessage("Opslaan mislukt door een netwerkfout. Probeer het opnieuw.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-panel border border-border bg-surface p-6 shadow-card"
    >
      <div className="grid grid-cols-1 gap-5">
        <div>
          <label htmlFor="category-name" className="font-heading text-body-sm font-semibold text-text">
            Naam
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label
            htmlFor="category-description"
            className="font-heading text-body-sm font-semibold text-text"
          >
            Beschrijving
          </label>
          <textarea
            id="category-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="category-sort-order"
              className="font-heading text-body-sm font-semibold text-text"
            >
              Sortering
            </label>
            <input
              id="category-sort-order"
              type="number"
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              required
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label
              htmlFor="category-parent"
              className="font-heading text-body-sm font-semibold text-text"
            >
              Bovenliggende categorie
            </label>
            <select
              id="category-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={NO_PARENT_VALUE}>Geen (top-niveau)</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="font-heading text-body-sm font-semibold text-text">Status</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((current) => !current)}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-button border px-3 py-2 text-body-sm font-semibold transition-colors duration-hover-fast",
              isActive
                ? "border-accent bg-accent/10 text-accent-hover"
                : "border-border bg-background text-muted"
            )}
          >
            <span
              className={cn(
                "inline-flex h-5 w-9 items-center rounded-full border border-border-hover transition-colors duration-hover-fast",
                isActive ? "bg-accent" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full bg-surface shadow-card transition-transform duration-hover-fast",
                  isActive ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </span>
            {isActive ? "Actief (zichtbaar op de site)" : "Inactief (verborgen op de site)"}
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "saving"}
          className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "saving" ? "Opslaan…" : "Opslaan"}
        </button>

        {state === "saved" ? (
          <span className="text-body-sm font-semibold text-accent-hover">Opgeslagen.</span>
        ) : null}
        {state === "error" ? (
          <span className="text-body-sm font-semibold text-red-700">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}

function errorMessageFor(code: string | undefined): string {
  switch (code) {
    case "INVALID_NAME":
      return "Naam mag niet leeg zijn.";
    case "INVALID_DESCRIPTION":
      return "Beschrijving is ongeldig.";
    case "INVALID_SORT_ORDER":
      return "Sortering moet een geheel getal zijn.";
    case "INVALID_IS_ACTIVE":
      return "Status is ongeldig.";
    case "INVALID_PARENT":
      return "Bovenliggende categorie is ongeldig.";
    case "SELF_PARENT":
      return "Een categorie kan niet zijn eigen bovenliggende categorie zijn.";
    case "PARENT_NOT_FOUND":
      return "De gekozen bovenliggende categorie bestaat niet.";
    case "CATEGORY_CYCLE":
      return "Deze keuze maakt een cirkel in de categorieboom. Kies een andere bovenliggende categorie.";
    case "CATEGORY_TOO_DEEP":
      return "De categorieboom mag maximaal drie niveaus bevatten.";
    case "NOT_FOUND":
      return "Categorie niet gevonden.";
    case "UNAUTHORIZED":
      return "Sessie verlopen. Log opnieuw in.";
    default:
      return "Opslaan is mislukt. Probeer het opnieuw.";
  }
}
