import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createAdminSupabaseClient } from "./supabase/server";

export const ADMIN_USERS_SETTING_KEY = "admin_users";
export const ADMIN_ROLES_SETTING_KEY = "admin_roles";
const ADMIN_SETTINGS_TABLE_MISSING_MESSAGE =
  "De database tabel public.admin_settings ontbreekt. Voer supabase/migrations/020_settings.sql uit op de Supabase database.";

export const ADMIN_PERMISSION_OPTIONS = [
  { id: "dashboard.read", label: "Dashboard bekijken" },
  { id: "orders.manage", label: "Bestellingen beheren" },
  { id: "products.manage", label: "Producten en voorraad beheren" },
  { id: "customers.manage", label: "Klanten beheren" },
  { id: "marketing.manage", label: "Marketing en CMS beheren" },
  { id: "settings.manage", label: "Instellingen beheren" },
  { id: "users.manage", label: "Gebruikers en rollen beheren" },
] as const;

export type AdminRole = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  system?: boolean;
};

export type StoredAdminUser = {
  id: string;
  username: string;
  displayName: string;
  roleId: string;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserProfile = Omit<StoredAdminUser, "passwordHash"> & {
  roleName: string;
  source: "stored" | "system";
};

const DEFAULT_ADMIN_ROLES: AdminRole[] = [
  {
    id: "owner",
    name: "Eigenaar",
    description: "Volledige toegang tot alle onderdelen van de adminomgeving.",
    permissions: ADMIN_PERMISSION_OPTIONS.map((permission) => permission.id),
    system: true,
  },
  {
    id: "manager",
    name: "Beheerder",
    description: "Dagelijks beheer van orders, producten, klanten en content.",
    permissions: [
      "dashboard.read",
      "orders.manage",
      "products.manage",
      "customers.manage",
      "marketing.manage",
      "settings.manage",
    ],
    system: true,
  },
  {
    id: "fulfilment",
    name: "Fulfilment",
    description: "Bestellingen, verzending en voorraad verwerken.",
    permissions: ["dashboard.read", "orders.manage", "products.manage"],
    system: true,
  },
  {
    id: "content",
    name: "Content",
    description: "Productteksten, pagina's, banners en marketing bijwerken.",
    permissions: ["dashboard.read", "products.manage", "marketing.manage"],
    system: true,
  },
];

function createSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || randomBytes(4).toString("hex");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingAdminSettingsTableError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("admin_settings") && (
      message.includes("could not find the table") ||
      message.includes("schema cache") ||
      message.includes("relation") && message.includes("does not exist")
    )
  );
}

function parseRoles(value: unknown): AdminRole[] {
  if (!isObject(value) || !Array.isArray(value.roles)) {
    return [];
  }

  return value.roles
    .filter(isObject)
    .map((role) => ({
      id: String(role.id ?? createSlug(String(role.name ?? ""))),
      name: String(role.name ?? ""),
      description: String(role.description ?? ""),
      permissions: Array.isArray(role.permissions) ? role.permissions.map(String) : [],
      system: Boolean(role.system),
    }))
    .filter((role) => role.id && role.name);
}

function parseUsers(value: unknown): StoredAdminUser[] {
  if (!isObject(value) || !Array.isArray(value.users)) {
    return [];
  }

  return value.users
    .filter(isObject)
    .map((user) => ({
      id: String(user.id ?? ""),
      username: normalizeUsername(String(user.username ?? "")),
      displayName: String(user.displayName ?? user.username ?? ""),
      roleId: String(user.roleId ?? "manager"),
      active: user.active !== false,
      passwordHash: String(user.passwordHash ?? ""),
      createdAt: String(user.createdAt ?? new Date().toISOString()),
      updatedAt: String(user.updatedAt ?? new Date().toISOString()),
    }))
    .filter((user) => user.id && user.username && user.passwordHash);
}

async function readSetting(key: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    if (isMissingAdminSettingsTableError(error)) {
      return undefined;
    }

    throw new Error(error.message);
  }

  return data?.value;
}

export async function getAdminAccessStorageStatus() {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("admin_settings").select("key").limit(1);

  if (!error) {
    return { ready: true, message: "" };
  }

  if (isMissingAdminSettingsTableError(error)) {
    return { ready: false, message: ADMIN_SETTINGS_TABLE_MISSING_MESSAGE };
  }

  throw new Error(error.message);
}

export async function writeAdminAccessSetting(key: string, value: Record<string, unknown>, actorEmail: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("admin_settings").upsert(
    {
      key,
      value,
      updated_by: actorEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    if (isMissingAdminSettingsTableError(error)) {
      throw new Error(ADMIN_SETTINGS_TABLE_MISSING_MESSAGE);
    }

    throw new Error(error.message);
  }
}

export async function listAdminRoles() {
  const storedRoles = parseRoles(await readSetting(ADMIN_ROLES_SETTING_KEY));
  const roleMap = new Map(DEFAULT_ADMIN_ROLES.map((role) => [role.id, role]));

  for (const role of storedRoles) {
    roleMap.set(role.id, { ...role, system: role.system ?? false });
  }

  return Array.from(roleMap.values());
}

export async function listStoredAdminUsers() {
  return parseUsers(await readSetting(ADMIN_USERS_SETTING_KEY));
}

export async function listAdminUserProfiles() {
  const [roles, storedUsers] = await Promise.all([listAdminRoles(), listStoredAdminUsers()]);
  const roleNames = new Map(roles.map((role) => [role.id, role.name]));
  const systemUsers: AdminUserProfile[] = [
    {
      id: "system-fedor",
      username: "fedor",
      displayName: "Fedor",
      roleId: "owner",
      roleName: roleNames.get("owner") ?? "Eigenaar",
      active: true,
      createdAt: "",
      updatedAt: "",
      source: "system",
    },
  ];

  if (process.env.ADMIN_EMAIL) {
    systemUsers.push({
      id: "system-env",
      username: normalizeUsername(process.env.ADMIN_EMAIL),
      displayName: process.env.ADMIN_EMAIL,
      roleId: "owner",
      roleName: roleNames.get("owner") ?? "Eigenaar",
      active: true,
      createdAt: "",
      updatedAt: "",
      source: "system",
    });
  }

  const storedProfiles = storedUsers.map(({ passwordHash, ...user }) => ({
    ...user,
    roleName: roleNames.get(user.roleId) ?? "Onbekende rol",
    source: "stored" as const,
  }));

  return [...systemUsers, ...storedProfiles];
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");

  return `scrypt:${salt}:${hash}`;
}

export function verifyAdminPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function authenticateStoredAdminUser(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const [roles, users] = await Promise.all([listAdminRoles(), listStoredAdminUsers()]);
  const user = users.find((item) => item.active && item.username === normalizedUsername);

  if (!user || !verifyAdminPassword(password, user.passwordHash)) {
    return null;
  }

  const role = roles.find((item) => item.id === user.roleId);

  return {
    username: user.username,
    sessionEmail: user.username,
    displayName: user.displayName,
    roleId: user.roleId,
    roleName: role?.name ?? "Onbekende rol",
  };
}

export function buildAdminRole(input: {
  name: string;
  description: string;
  permissions: string[];
  id?: string;
}): AdminRole {
  return {
    id: input.id ? createSlug(input.id) : createSlug(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    permissions: input.permissions,
    system: false,
  };
}
