import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { DEVELOPER_SESSION_COOKIE, verifyDeveloperSessionToken } from "./auth";

/** For admin pages: the logged-in admin, or a redirect to the admin login. */
export async function requireAdminPage(): Promise<{ adminUserId: string }> {
  const store = await cookies();
  const session = await verifyAdminSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({ where: { id: session.userId }, select: { active: true } });
  if (!admin?.active) redirect("/admin/login");
  return { adminUserId: session.userId };
}

/** Whether this admin also holds a valid developer session. */
export async function hasDeveloperPageSession(adminUserId: string): Promise<boolean> {
  return verifyDeveloperSessionToken((await cookies()).get(DEVELOPER_SESSION_COOKIE)?.value, adminUserId);
}
