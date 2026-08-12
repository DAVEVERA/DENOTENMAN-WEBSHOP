import Link from "next/link";
import { AdminMenu } from "./AdminMenu";
import { getAdminSession, logoutAction } from "../../lib/admin-auth";

export async function AdminHeader() {
  const session = await getAdminSession();

  return (
    <header className="admin-header">
      <Link href="/" className="admin-header__logo">
        <img src="/Notenman_onlylogo.png" alt="De Notenman Admin" />
      </Link>

      <AdminMenu isAuthenticated={Boolean(session)} logoutAction={logoutAction} />
    </header>
  );
}
