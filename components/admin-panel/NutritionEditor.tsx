"use client";

export const nutritionFields = [
  { key: "nutrition.energyKj", label: "Energie (kJ)", suffix: "kJ" },
  { key: "nutrition.energyKcal", label: "Energie (kcal)", suffix: "kcal" },
  { key: "nutrition.fat", label: "Vetten", suffix: "g" },
  { key: "nutrition.saturatedFat", label: "waarvan verzadigd", suffix: "g" },
  { key: "nutrition.carbohydrates", label: "Koolhydraten", suffix: "g" },
  { key: "nutrition.sugars", label: "waarvan suikers", suffix: "g" },
  { key: "nutrition.fiber", label: "Vezels", suffix: "g" },
  { key: "nutrition.protein", label: "Eiwitten", suffix: "g" },
  { key: "nutrition.salt", label: "Zout", suffix: "g" },
] as const;

export type NutritionValues = Record<(typeof nutritionFields)[number]["key"], string>;

export function emptyNutritionValues(): NutritionValues {
  return Object.fromEntries(nutritionFields.map((field) => [field.key, ""])) as NutritionValues;
}

export function NutritionEditor({
  values,
  onChange,
  unit,
}: {
  values: NutritionValues;
  onChange: (values: NutritionValues) => void;
  unit: "WEIGHT" | "VOLUME";
}) {
  return (
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <h2 className="text-heading-md text-text">Voedingswaarden</h2>
      <p className="mt-1 text-body-sm text-muted">
        Vul waarden per {unit === "VOLUME" ? "100 ml" : "100 gram"} in. Laat onbekende waarden leeg; AI mag deze nooit verzinnen.
      </p>
      <div className="mt-5 overflow-hidden rounded-button border border-border">
        {nutritionFields.map((field) => (
          <label
            key={field.key}
            className="grid min-h-12 grid-cols-[minmax(0,1fr)_7rem_3rem] items-center gap-2 border-b border-border px-3 py-2 text-body-sm last:border-0"
          >
            <span className="font-semibold text-text">{field.label}</span>
            <input
              inputMode="decimal"
              value={values[field.key]}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              aria-label={field.label}
              className="min-h-10 min-w-0 rounded-button border border-border px-2 text-right text-text"
            />
            <span className="text-muted">{field.suffix}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
