export const adminPermissions = [
  "catalog:read",
  "catalog:write",
  "orders:read",
  "orders:write",
  "customers:read",
  "settings:write",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

export type AdminRole = "owner" | "manager" | "support";

const rolePermissions: Record<AdminRole, readonly AdminPermission[]> = {
  owner: adminPermissions,
  manager: ["catalog:read", "catalog:write", "orders:read", "orders:write", "customers:read"],
  support: ["catalog:read", "orders:read", "customers:read"],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission) {
  return rolePermissions[role].includes(permission);
}
