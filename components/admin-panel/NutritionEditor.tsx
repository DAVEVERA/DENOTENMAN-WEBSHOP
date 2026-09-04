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

export const productInformationFields = [
  { key: "ingredients", label: "Ingrediënten", hint: "Neem de ingrediënten letterlijk over van de verpakking of productspecificatie." },
  { key: "allergens", label: "Allergenen", hint: "Noem alleen bevestigde allergenen. Laat het veld leeg als de informatie nog ontbreekt." },
  { key: "mayContainTraces", label: "Kan sporen bevatten van", hint: "Vul eventuele kruisbesmettingswaarschuwingen apart in." },
] as const;

type NutritionKey = (typeof nutritionFields)[number]["key"];
type ProductInformationKey = (typeof productInformationFields)[number]["key"];

export type NutritionValues = Record<NutritionKey | ProductInformationKey, string>;

export function emptyNutritionValues(): NutritionValues {
  return Object.fromEntries(
    [...nutritionFields, ...productInformationFields].map((field) => [field.key, ""])
  ) as NutritionValues;
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
      <p id="nutrition-format-help" className="mt-1 text-body-sm text-muted">
        Gebruik alleen positieve getallen, met maximaal drie decimalen (bijvoorbeeld 0,01).
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
              pattern="[0-9]+([.,][0-9]{1,3})?"
              maxLength={12}
              value={values[field.key]}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              aria-label={field.label}
              aria-describedby="nutrition-format-help"
              className="min-h-11 min-w-0 rounded-button border border-border px-2 text-right text-text"
            />
            <span className="text-muted">{field.suffix}</span>
          </label>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        <div>
          <h3 className="font-heading text-heading-sm text-text">Ingrediënten en allergenen</h3>
          <p className="mt-1 text-body-sm text-muted">
            Deze informatie krijgt op iedere productpagina een eigen tabblad. Vul niets op basis van aannames in.
          </p>
        </div>
        {productInformationFields.map((field) => (
          <label key={field.key} className="block text-body-sm font-semibold text-text">
            {field.label}
            <textarea
              value={values[field.key]}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              maxLength={10_000}
              rows={3}
              className="mt-1 min-h-24 w-full resize-y rounded-button border border-border bg-white px-3 py-2 text-base font-normal text-text focus:outline-none focus:ring-2 focus:ring-accent sm:text-body-sm"
            />
            <span className="mt-1 block font-normal text-muted">{field.hint}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
