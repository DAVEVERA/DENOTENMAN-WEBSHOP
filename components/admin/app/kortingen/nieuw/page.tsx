import { saveDiscountAction } from "../../../actions/marketing.actions";

export default function NewDiscountPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Marketing</p>
        <h1>Nieuwe korting</h1>
        <span>Maak een kortingscode of actie aan.</span>
      </section>

      <form className="admin-form" action={saveDiscountAction}>
        <label>
          Kortingscode
          <input type="text" name="code" placeholder="Bijvoorbeeld: WELKOM10" />
        </label>

        <label>
          Naam
          <input type="text" name="name" placeholder="Bijvoorbeeld: Welkomstkorting" />
        </label>

        <label>
          Type korting
          <select name="discountType" defaultValue="percent">
            <option value="percent">Percentage</option>
            <option value="fixed">Vast bedrag</option>
            <option value="free_shipping">Gratis verzending</option>
          </select>
        </label>

        <label>
          Waarde
          <input type="number" step="0.01" min="0" name="value" placeholder="Bijvoorbeeld: 10" />
        </label>

        <label className="admin-checkbox">
          <input type="checkbox" name="isActive" defaultChecked />
          Actief
        </label>

        <button className="admin-button" type="submit">
          Korting aanmaken
        </button>
      </form>
    </main>
  );
}
