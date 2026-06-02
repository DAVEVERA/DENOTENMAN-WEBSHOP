import { saveBusinessCustomerAction } from "../../../../actions/customer.actions";

export default function NewBusinessCustomerPage() {
  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Zakelijke klant</p>
        <h1>Nieuwe klant</h1>
        <span>
          Voeg een bedrijf toe aan de zakelijke bestelomgeving.
        </span>
      </section>

      <form className="admin-form admin-form--wide" action={saveBusinessCustomerAction}>
        <fieldset className="admin-form-section">
          <legend>Bedrijfsgegevens</legend>
          <div className="admin-form-grid">
            <label>
              Bedrijfsnaam
              <input type="text" name="company" placeholder="Bedrijfsnaam" autoComplete="organization" required />
            </label>

            <label>
              Contactpersoon
              <input type="text" name="contact" placeholder="Naam contactpersoon" autoComplete="name" />
            </label>
          </div>

          <div className="admin-form-grid">
            <label>
              E-mailadres
              <input type="email" name="email" placeholder="inkoop@bedrijf.nl" autoComplete="email" required />
            </label>

            <label>
              Telefoonnummer
              <input type="tel" name="phone" placeholder="+31..." autoComplete="tel" />
            </label>
          </div>

          <div className="admin-form-grid">
            <label>
              KVK-nummer
              <input type="text" name="kvkNumber" placeholder="12345678" inputMode="numeric" />
            </label>

            <label>
              BTW-nummer
              <input type="text" name="vatNumber" placeholder="NL123456789B01" autoComplete="off" />
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-form-section">
          <legend>Adressen</legend>
          <label>
            Factuuradres
            <textarea
              name="invoiceAddress"
              placeholder="Straat en huisnummer, postcode, plaats"
              autoComplete="billing street-address"
            />
          </label>

          <label>
            Leveradres
            <textarea
              name="shippingAddress"
              placeholder="Laat leeg als dit gelijk is aan het factuuradres"
              autoComplete="shipping street-address"
            />
          </label>
        </fieldset>

        <fieldset className="admin-form-section">
          <legend>Instellingen</legend>
          <div className="admin-form-grid">
            <label>
              Status
              <select name="status" defaultValue="active">
                <option value="active">Actief</option>
                <option value="pending">In aanvraag</option>
                <option value="paused">Gepauzeerd</option>
              </select>
            </label>

            <label className="admin-checkbox admin-checkbox--panel">
              <input type="checkbox" name="paymentOnAccount" />
              <span>Op rekening bestellen toestaan</span>
            </label>
          </div>

          <label>
            Opmerking
            <textarea name="notes" placeholder="Interne notities, afspraken of bestelvoorwaarden" />
          </label>
        </fieldset>

        <button className="admin-button" type="submit">
          Zakelijke klant aanmaken
        </button>
      </form>
    </main>
  );
}
