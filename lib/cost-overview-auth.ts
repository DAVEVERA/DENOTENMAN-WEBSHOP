import type { AdminUser } from "@prisma/client";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";

const DEVELOPER_ALLOWLIST_ENV = "COST_OVERVIEW_DEVELOPER_USERNAMES";

function developerUsernames(): Set<string> {
  return new Set(
    (process.env[DEVELOPER_ALLOWLIST_ENV] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Cost writes are intentionally narrower than ordinary admin writes.
 * A writer must be an OWNER and be explicitly named in the deployment allowlist.
 * An absent or empty allowlist fails closed.
 */
export function canManageCostOverview(
  admin: Pick<AdminUser, "role" | "username">,
): boolean {
  return (
    admin.role === "OWNER" &&
    developerUsernames().has(admin.username.trim().toLowerCase())
  );
}

export async function authenticateCostOverview(request: NextRequest): Promise<{
  admin: AdminUser | null;
  canManage: boolean;
}> {
  const admin = await getAdminSession(request);
  return { admin, canManage: admin ? canManageCostOverview(admin) : false };
}
