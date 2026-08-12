import { redirect } from "next/navigation";
import { getAdminSession, loginAction } from "../../../../lib/admin-auth";

type AdminLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  if (error === "config") {
    return "Admin-login is nog niet geconfigureerd. Zet ADMIN_SESSION_SECRET.";
  }

  if (error === "invalid") {
    return "Gebruikersnaam of wachtwoord klopt niet.";
  }

  return null;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await getAdminSession();

  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = getErrorMessage(params?.error);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Admin</p>
        <h1>Inloggen</h1>
        <span>Log in om de beheeromgeving te openen.</span>
      </section>

      {errorMessage ? <p className="admin-alert">{errorMessage}</p> : null}

      <form className="admin-form" action={loginAction}>
        <label>
          Gebruikersnaam
          <input type="text" name="email" autoComplete="username" required />
        </label>

        <label>
          Wachtwoord
          <input type="password" name="password" autoComplete="current-password" required />
        </label>

        <button className="admin-button" type="submit">
          Inloggen
        </button>
      </form>
    </main>
  );
}
