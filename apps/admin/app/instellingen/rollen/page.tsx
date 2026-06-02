import { getAdminSettingsStatus } from "../../../lib/settings";

export default async function RolesSettingsPage() {
  const settings = await getAdminSettingsStatus();

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Rollen</h1>
        <span>Actieve rollen binnen de huidige admin-auth implementatie.</span>
      </section>

      <section className="admin-list">
        {settings.roles.map((role) => (
          <article key={role.name} className="admin-list-row">
            <div>
              <h2>{role.name}</h2>
              <p>{role.permissions}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
