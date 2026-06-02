export default function BusinessLoginPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">

        <h1>Inloggen</h1>

        <form className="auth-form">
          <label>
            E-mailadres
            <input type="email" name="email" autoComplete="email" />
          </label>

          <label>
            Wachtwoord
            <input type="password" name="password" autoComplete="current-password" />
          </label>

          <button className="button button--primary" type="submit">
            Inloggen
          </button>
        </form>
      </section>
    </main>
  );
}