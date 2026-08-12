"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  ADMIN_ROLES_SETTING_KEY,
  ADMIN_USERS_SETTING_KEY,
  buildAdminRole,
  hashAdminPassword,
  listAdminRoles,
  listStoredAdminUsers,
  writeAdminAccessSetting,
} from "../lib/admin-users";
import { createAuditLog } from "../lib/audit";
import { requireAdminPermission } from "../lib/admin-auth";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isReservedSystemUsername(username: string) {
  const reserved = ["fedor"];

  if (process.env.ADMIN_EMAIL) {
    reserved.push(normalizeUsername(process.env.ADMIN_EMAIL));
  }

  return reserved.includes(username);
}

export async function saveAdminUserAction(formData: FormData) {
  const session = await requireAdminPermission("users.manage");
  const username = normalizeUsername(getString(formData, "username"));
  const displayName = getString(formData, "displayName") || username;
  const password = getString(formData, "password");
  const roleId = getString(formData, "roleId");
  const active = formData.get("active") === "on";

  if (!username) {
    throw new Error("Gebruikersnaam ontbreekt.");
  }

  if (isReservedSystemUsername(username)) {
    throw new Error("Deze gebruikersnaam is gereserveerd voor een systeemaccount.");
  }

  if (password.length < 8) {
    throw new Error("Gebruik een wachtwoord van minimaal 8 tekens.");
  }

  const [roles, users] = await Promise.all([listAdminRoles(), listStoredAdminUsers()]);

  if (!roles.some((role) => role.id === roleId)) {
    throw new Error("Kies een geldige rol.");
  }

  const now = new Date().toISOString();
  const existingUser = users.find((user) => user.username === username);
  const nextUsers = [
    ...users.filter((user) => user.username !== username),
    {
      id: existingUser?.id ?? randomUUID(),
      username,
      displayName,
      roleId,
      active,
      passwordHash: hashAdminPassword(password),
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now,
    },
  ].sort((left, right) => left.username.localeCompare(right.username));

  await writeAdminAccessSetting(ADMIN_USERS_SETTING_KEY, { users: nextUsers }, session.email);
  await createAuditLog({
    actorEmail: session.email,
    action: existingUser ? "Admin gebruiker bijgewerkt" : "Admin gebruiker aangemaakt",
    entityType: "admin_user",
    entityId: username,
  });

  revalidatePath("/instellingen/gebruikers");
}

export async function deleteAdminUserAction(formData: FormData) {
  const session = await requireAdminPermission("users.manage");
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("Gebruiker ontbreekt.");
  }

  const users = await listStoredAdminUsers();
  const user = users.find((item) => item.id === id);

  if (!user) {
    throw new Error("Gebruiker niet gevonden.");
  }

  await writeAdminAccessSetting(
    ADMIN_USERS_SETTING_KEY,
    { users: users.filter((item) => item.id !== id) },
    session.email,
  );
  await createAuditLog({
    actorEmail: session.email,
    action: "Admin gebruiker verwijderd",
    entityType: "admin_user",
    entityId: user.username,
  });

  revalidatePath("/instellingen/gebruikers");
}

export async function saveAdminRoleAction(formData: FormData) {
  const session = await requireAdminPermission("users.manage");
  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const permissions = getStrings(formData, "permissions");

  if (!name) {
    throw new Error("Rolnaam ontbreekt.");
  }

  if (permissions.length === 0) {
    throw new Error("Kies minimaal een permissie.");
  }

  const roles = await listAdminRoles();
  const customRoles = roles.filter((role) => !role.system);
  const role = buildAdminRole({ name, description, permissions });
  const nextRoles = [
    ...customRoles.filter((item) => item.id !== role.id),
    role,
  ].sort((left, right) => left.name.localeCompare(right.name));

  await writeAdminAccessSetting(ADMIN_ROLES_SETTING_KEY, { roles: nextRoles }, session.email);
  await createAuditLog({
    actorEmail: session.email,
    action: "Admin rol opgeslagen",
    entityType: "admin_role",
    entityId: role.id,
  });

  revalidatePath("/instellingen/rollen");
  revalidatePath("/instellingen/gebruikers");
}

export async function deleteAdminRoleAction(formData: FormData) {
  const session = await requireAdminPermission("users.manage");
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("Rol ontbreekt.");
  }

  const [roles, users] = await Promise.all([listAdminRoles(), listStoredAdminUsers()]);
  const role = roles.find((item) => item.id === id);

  if (!role || role.system) {
    throw new Error("Deze rol kan niet worden verwijderd.");
  }

  if (users.some((user) => user.roleId === id)) {
    throw new Error("Deze rol is nog gekoppeld aan een gebruiker.");
  }

  await writeAdminAccessSetting(
    ADMIN_ROLES_SETTING_KEY,
    { roles: roles.filter((item) => !item.system && item.id !== id) },
    session.email,
  );
  await createAuditLog({
    actorEmail: session.email,
    action: "Admin rol verwijderd",
    entityType: "admin_role",
    entityId: id,
  });

  revalidatePath("/instellingen/rollen");
  revalidatePath("/instellingen/gebruikers");
}
