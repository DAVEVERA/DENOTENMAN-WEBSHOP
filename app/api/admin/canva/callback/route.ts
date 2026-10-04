import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { CanvaError, exchangeAuthorizationCode } from "@/lib/canva/api";
import { CANVA_CALLBACK_PATH, canvaConfig } from "@/lib/canva/config";
import { saveNewCanvaConnection } from "@/lib/canva/connection";
import { CANVA_STATE_COOKIE } from "@/lib/canva/http";
import { safeAdminPath } from "@/lib/canva/return-token";
import { BASE_URL } from "@/lib/routes";
import { openWithPurpose } from "@/lib/secret-box";

export const runtime = "nodejs";
// Redirects use SITE_URL: behind Cloud Run, request.nextUrl.origin is the container address (0.0.0.0:8080).

type StoredState = { state: string; verifier: string; adminId: string; returnTo: string; expiresAt: number };

function readState(value: string | undefined): StoredState | null {
  const opened = openWithPurpose(value, "canva-oauth-state");
  if (!opened) return null;
  try {
    const parsed = JSON.parse(opened) as Partial<StoredState>;
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string" || typeof parsed.adminId !== "string" || typeof parsed.expiresAt !== "number") return null;
    return { state: parsed.state, verifier: parsed.verifier, adminId: parsed.adminId, returnTo: safeAdminPath(parsed.returnTo), expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

// Canva sends the admin back here with a one-time code after they allow access.
export async function GET(request: NextRequest) {
  const stored = readState(request.cookies.get(CANVA_STATE_COOKIE)?.value);
  const back = new URL(stored?.returnTo ?? "/admin/instellingen/integraties", BASE_URL);
  const finish = (message: string) => {
    back.searchParams.set("canva", message);
    const response = NextResponse.redirect(back);
    response.cookies.set({ name: CANVA_STATE_COOKIE, value: "", path: CANVA_CALLBACK_PATH, maxAge: 0 });
    return response;
  };

  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.redirect(new URL("/admin/login", BASE_URL));
  const params = request.nextUrl.searchParams;
  if (!stored || stored.adminId !== admin.id || stored.expiresAt < Date.now() || params.get("state") !== stored.state) {
    return finish("De Canva-koppeling is verlopen of kwam niet van dit portaal. Probeer het opnieuw.");
  }
  if (params.get("error")) return finish("Canva: toestemming is niet gegeven.");
  const code = params.get("code");
  const config = canvaConfig();
  if (!code || !config) return finish("Canva gaf geen code terug.");
  try {
    const connection = await saveNewCanvaConnection(await exchangeAuthorizationCode(config, code, stored.verifier), admin.id);
    return finish(`verbonden${connection.displayName ? `:${connection.displayName}` : ""}`);
  } catch (error) {
    return finish(error instanceof CanvaError ? error.message : "Koppelen met Canva is mislukt.");
  }
}
