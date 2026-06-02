export default function ForgotPasswordPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Wachtwoord vergeten</h1>
        <p>Vul je e-mailadres in om een resetlink te ontvangen.</p>

        <form className="auth-form">
          <label>
            E-mailadres
            <input type="email" name="email" autoComplete="email" />
          </label>

          <button className="button button--primary" type="submit">
            Resetlink versturen
          </button>
        </form>
      </section>
    </main>
  );
}