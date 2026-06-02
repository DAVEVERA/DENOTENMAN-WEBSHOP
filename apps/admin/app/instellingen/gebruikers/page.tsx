import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function UsersSettingsPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Gebruikers</h1>
        <span>Huidige admin-auth werkt met een server-side gesigneerde eigenaarssessie.</span>
      </section>

      <section className="admin-list">
        {settings.users.map((user) => (
          <article key={user.email} className="admin-list-row">
            <div>
              <h2>{user.email}</h2>
              <p>{user.role}</p>
            </div>
            <strong>{user.status}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
