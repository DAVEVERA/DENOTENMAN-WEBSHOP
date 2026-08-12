import "server-only";

export type AdminPermission =
  | "catalog:write"
  | "media:write"
  | "orders:write"
  | "content:write"
  | "settings:write"
  | "business:write";

export const ownerPermissions: AdminPermission[] = [
  "catalog:write",
  "media:write",
  "orders:write",
  "content:write",
  "settings:write",
  "business:write",
];

export function hasAdminPermission(permission: AdminPermission) {
  return ownerPermissions.includes(permission);
}
