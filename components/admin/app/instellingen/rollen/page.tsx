import { deleteAdminRoleAction, saveAdminRoleAction } from "../../../actions/admin-users.actions";
import {
  ADMIN_PERMISSION_OPTIONS,
  getAdminAccessStorageStatus,
  listAdminRoles,
  listStoredAdminUsers,
} from "../../../lib/admin-users";

export default async function RolesSettingsPage() {
  const [storageStatus, roles, users] = await Promise.all([
    getAdminAccessStorageStatus(),
    listAdminRoles(),
    listStoredAdminUsers(),
  ]);
  const userCounts = new Map<string, number>();

  for (const user of users) {
    userCounts.set(user.roleId, (userCounts.get(user.roleId) ?? 0) + 1);
  }

  return (
    <main className="admin-main">
      <section className="admin-page-header">
        <p>Instellingen</p>
        <h1>Rollen</h1>
        <span>Maak rollen aan met duidelijke rechten voor verschillende admin gebruikers.</span>
      </section>

      {!storageStatus.ready && <p className="admin-alert">{storageStatus.message}</p>}

      <form className="admin-form admin-form--wide admin-section" action={saveAdminRoleAction}>
        <fieldset className="admin-form-section">
          <legend>Nieuwe rol</legend>
          <div className="admin-form-grid">
            <label>
              Rolnaam
              <input name="name" type="text" required />
            </label>
            <label>
              Omschrijving
              <input name="description" type="text" />
            </label>
          </div>
          <div className="admin-permission-grid" aria-label="Permissies">
            {ADMIN_PERMISSION_OPTIONS.map((permission) => (
              <label key={permission.id} className="admin-checkbox admin-checkbox--panel">
                <input name="permissions" type="checkbox" value={permission.id} />
                {permission.label}
              </label>
            ))}
          </div>
          <button className="admin-button" type="submit">
            Rol toevoegen
          </button>
        </fieldset>
      </form>

      <section className="admin-list admin-section" aria-label="Admin rollen">
        {roles.map((role) => (
          <article key={role.id} className="admin-list-row">
            <div>
              <h2>{role.name}</h2>
              <p>{role.description}</p>
              <span>
                {role.permissions.length} rechten · {userCounts.get(role.id) ?? 0} gebruikers
              </span>
            </div>
            <strong>{role.system ? "Standaard" : "Aangepast"}</strong>
            {!role.system && (userCounts.get(role.id) ?? 0) === 0 ? (
              <form action={deleteAdminRoleAction}>
                <input name="id" type="hidden" value={role.id} />
                <button className="admin-button admin-button--danger" type="submit">
                  Verwijderen
                </button>
              </form>
            ) : (
              <span>{role.system ? "Niet verwijderbaar" : "In gebruik"}</span>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
