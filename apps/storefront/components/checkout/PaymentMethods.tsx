export function PaymentMethods() {
  return (
    <>
      <label>
        Betaalmethode
        <select name="payment">
          <option value="ideal">iDEAL via Mollie</option>
          <option value="bancontact">Bancontact via Mollie</option>
          <option value="creditcard">Creditcard via Mollie</option>
        </select>
      </label>

      <label className="form-field">
        <span>Voorwaarden</span>
        <span>
          <input type="checkbox" name="termsAccepted" required /> Ik ga akkoord met de voorwaarden.
        </span>
      </label>
    </>
  );
}
