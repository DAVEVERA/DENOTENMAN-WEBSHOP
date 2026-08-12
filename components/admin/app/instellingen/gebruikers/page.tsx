import { deleteAdminUserAction, saveAdminUserAction } from "../../../actions/admin-users.actions";
import { getAdminAccessStorageStatus, listAdminRoles, listAdminUserProfiles } from "../../../lib/admin-users";

export default async function UsersSettingsPage() {
  const [storageStatus, roles, users] = await Promise.all([
    getAdminAccessStorageStatus(),
    listAdminRoles(),
    listAdminUserProfiles(),
  ]);

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Gebruikers</h1>
        <span>Voeg adminaccounts toe, koppel rollen en schakel toegang uit wanneer nodig.</span>
      </section>

      {!storageStatus.ready && <p className="admin-alert">{storageStatus.message}</p>}

      <form className="admin-form admin-form--wide admin-section" action={saveAdminUserAction}>
        <fieldset className="admin-form-section">
          <legend>Nieuwe gebruiker</legend>
          <div className="admin-form-grid">
            <label>
              Gebruikersnaam of e-mail
              <input name="username" type="text" autoComplete="username" required />
            </label>
            <label>
              Weergavenaam
              <input name="displayName" type="text" autoComplete="name" />
            </label>
            <label>
              Rol
              <select name="roleId" defaultValue="manager" required>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tijdelijk wachtwoord
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <label className="admin-checkbox admin-checkbox--panel">
              <input name="active" type="checkbox" defaultChecked />
              Actief
            </label>
          </div>
          <button className="admin-button" type="submit">
            Gebruiker toevoegen
          </button>
        </fieldset>
      </form>

      <section className="admin-list admin-section" aria-label="Admin gebruikers">
        {users.map((user) => (
          <article key={`${user.source}-${user.id}`} className="admin-list-row">
            <div>
              <h2>{user.displayName}</h2>
              <p>{user.username}</p>
              <span>{user.roleName}</span>
            </div>
            <strong>{user.active ? "Actief" : "Uitgeschakeld"}</strong>
            {user.source === "stored" ? (
              <form action={deleteAdminUserAction}>
                <input name="id" type="hidden" value={user.id} />
                <button className="admin-button admin-button--danger" type="submit">
                  Verwijderen
                </button>
              </form>
            ) : (
              <span>Systeemaccount</span>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
