import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import {
  clientKeyFor,
  createDeveloperSessionToken,
  DEVELOPER_SESSION_COOKIE,
  developerSessionCookie,
  verifyDeveloperCredentials,
} from "@/lib/developer-portal/auth";
import { developerJson, readJson } from "@/lib/developer-portal/http";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().max(100),
  password: z.string().max(200),
}).strict();

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return developerJson({ error: "UNAUTHORIZED", message: "Log eerst in op het beheerportaal." }, 401);
  if (!hasSameOrigin(request)) return developerJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403);
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return developerJson({ error: "INVALID_INPUT", message: "Vul gebruikersnaam en wachtwoord in." }, 422);

  const result = await verifyDeveloperCredentials(parsed.data.username, parsed.data.password, clientKeyFor(request));
  if (result === "NOT_CONFIGURED") return developerJson({ error: "NOT_CONFIGURED", message: "Het ontwikkelaarsportaal is nog niet ingesteld." }, 503);
  if (result === "LOCKED") return developerJson({ error: "LOCKED", message: "Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw." }, 429);
  if (result === "INVALID") return developerJson({ error: "INVALID_CREDENTIALS", message: "Gebruikersnaam of wachtwoord klopt niet." }, 401);

  const response = developerJson({ ok: true });
  response.cookies.set(developerSessionCookie(createDeveloperSessionToken(admin.id)));
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!hasSameOrigin(request)) return developerJson({ error: "INVALID_ORIGIN", message: "Ongeldige herkomst." }, 403);
  const response = developerJson({ ok: true });
  response.cookies.set({ name: DEVELOPER_SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
