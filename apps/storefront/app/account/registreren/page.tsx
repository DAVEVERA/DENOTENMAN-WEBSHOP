export default function RegisterPage() {
  return (
    <main className="business-page">
      <section className="container auth-card">
        <h1>Registreren</h1>

        <form className="auth-form">
          <label>
            Naam
            <input type="text" name="name" autoComplete="name" />
          </label>

          <label>
            E-mailadres
            <input type="email" name="email" autoComplete="email" />
          </label>

          <label>
            Wachtwoord
            <input type="password" name="password" autoComplete="new-password" />
          </label>

          <button className="button button--primary" type="submit">
            Account aanmaken
          </button>
        </form>
      </section>
    </main>
  );
}