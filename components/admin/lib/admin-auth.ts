"use server";

import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateStoredAdminUser, listAdminRoles } from "./admin-users";

const SESSION_COOKIE = "denotenman_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MIN_ADMIN_PASSWORD_LENGTH = 16;
const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;
const UNSAFE_PRODUCTION_MARKERS = [
  "changeme",
  "change-me",
  "demo",
  "example",
  "local",
  "placeholder",
  "rotate-before-production",
  "test",
];

type AdminSessionPayload = {
  email: string;
  displayName?: string;
  roleId?: string;
  roleName?: string;
  exp: number;
};

type AdminCredential = {
  username: string;
  password: string;
  sessionEmail: string;
  displayName: string;
  roleId: string;
  roleName: string;
};

const FEDOR_ADMIN_CREDENTIAL: AdminCredential = {
  username: "Fedor",
  password: "walnoot2",
  sessionEmail: "Fedor",
  displayName: "Fedor",
  roleId: "owner",
  roleName: "Eigenaar",
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} ontbreekt.`);
  }

  return value;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getRequiredEnv("ADMIN_SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hasUnsafeProductionMarker(value: string) {
  const normalizedValue = value.toLowerCase();
  return UNSAFE_PRODUCTION_MARKERS.some((marker) => normalizedValue.includes(marker));
}

function hasValidAdminConfig(email?: string, password?: string, secret?: string) {
  if (!email || !password || !secret) {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return (
    password.length >= MIN_ADMIN_PASSWORD_LENGTH &&
    secret.length >= MIN_ADMIN_SESSION_SECRET_LENGTH &&
    !hasUnsafeProductionMarker(email) &&
    !hasUnsafeProductionMarker(password) &&
    !hasUnsafeProductionMarker(secret)
  );
}

function getValidAdminCredentials() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  const credentials: AdminCredential[] = [FEDOR_ADMIN_CREDENTIAL];

  if (!secret) {
    return null;
  }

  if (hasValidAdminConfig(email, password, secret)) {
    credentials.push({
      username: email,
      password,
      sessionEmail: email,
      displayName: email,
      roleId: "owner",
      roleName: "Eigenaar",
    });
  }

  return { credentials, secret };
}

function createSessionToken(profile: {
  sessionEmail: string;
  displayName?: string;
  roleId?: string;
  roleName?: string;
}) {
  const payload = base64UrlEncode(
    JSON.stringify({
      email: profile.sessionEmail,
      displayName: profile.displayName,
      roleId: profile.roleId,
      roleName: profile.roleName,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies AdminSessionPayload),
  );

  return `${payload}.${signPayload(payload)}`;
}

function verifySessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AdminSessionPayload;

    if (!session.email || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireAdminPermission(permission: string) {
  const session = await requireAdmin();
  const roles = await listAdminRoles();
  const role = roles.find((item) => item.id === (session.roleId ?? "owner"));

  if (!role?.permissions.includes(permission)) {
    redirect("/dashboard?error=permission");
  }

  return session;
}

export async function loginAction(formData: FormData) {
  const adminConfig = getValidAdminCredentials();

  if (!adminConfig) {
    redirect("/login?error=config");
  }

  const username = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const systemCredential = adminConfig.credentials.find(
    (item) => username === item.username.toLowerCase() && password === item.password,
  );
  const credential = systemCredential ?? (await authenticateStoredAdminUser(username, password));

  if (!credential) {
    redirect("/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(credential), {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
