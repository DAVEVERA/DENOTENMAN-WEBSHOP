import { saveProductAction } from "../../../actions/product.actions";

const categories = [
  { value: "noten", label: "Noten" },
  { value: "zuidvruchten", label: "Gedroogd fruit" },
  { value: "snacks", label: "Snacks" },
  { value: "zaden-pitten", label: "Pitten & Zaden" },
  { value: "superfoods", label: "Superfood" },
  { value: "overig", label: "Natuurvoeding" },
  { value: "honing", label: "Honing" },
  { value: "mixen", label: "Mixen" },
];

export default function NewProductPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Catalogus</p>
        <h1>Nieuw product</h1>
        <span>Voeg een product toe aan de Supabase catalogus en upload direct een foto.</span>
      </section>

      <form className="admin-form admin-form--wide" action={saveProductAction}>
        <label>
          Productnaam
          <input type="text" name="name" placeholder="Productnaam" required />
        </label>

        <label>
          Slug
          <input type="text" name="slug" placeholder="wordt automatisch gemaakt als je dit leeg laat" />
        </label>

        <div className="admin-form-grid">
          <label>
            Categorie
            <select name="category" defaultValue="noten">
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Categorielabel
            <input type="text" name="categoryLabel" placeholder="Noten" />
          </label>
        </div>

        <div className="admin-form-grid">
          <label>
            Basisprijs
            <input type="number" step="0.01" min="0" name="basePrice" required />
          </label>

          <label>
            Eenheid
            <input type="text" name="unit" placeholder="per stuk, per 100g" />
          </label>
        </div>

        <label>
          Productfoto
          <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" />
        </label>

        <label>
          Foto-URL
          <input type="url" name="image" placeholder="Optioneel als je geen bestand uploadt" />
        </label>

        <label>
          Korte omschrijving
          <textarea name="description" placeholder="Omschrijving voor de productpagina" />
        </label>

        <div className="admin-form-grid">
          <label>
            Badge
            <input type="text" name="badge" placeholder="Nieuw, Populair, Actie" />
          </label>

          <label>
            Herkomst
            <input type="text" name="origin" placeholder="Bijvoorbeeld: Spanje" />
          </label>
        </div>

        <label className="admin-checkbox">
          <input type="checkbox" name="isActive" defaultChecked />
          Zichtbaar in webshop
        </label>

        <button className="admin-button" type="submit">
          Product opslaan
        </button>
      </form>
    </main>
  );
}
