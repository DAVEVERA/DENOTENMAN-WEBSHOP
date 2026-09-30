import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { SOCIAL_STATE_COOKIE, socialRedirectUri } from "@/lib/social/http";
import { connectionByKey } from "@/lib/social/providers";
import { saveConnectedAccounts } from "@/lib/social/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ provider: string }> };

function sameValue(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The platform sends the admin back here with a one-time code after logging in.
export async function GET(request: NextRequest, context: Context) {
  const channelsPage = new URL("/admin/marketing/social/kanalen", request.nextUrl.origin);
  const finish = (key: "verbonden" | "fout", value: string) => {
    channelsPage.searchParams.set(key, value);
    const response = NextResponse.redirect(channelsPage);
    response.cookies.set({ name: SOCIAL_STATE_COOKIE, value: "", path: "/api/admin/social/callback", maxAge: 0 });
    return response;
  };

  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
  const connection = connectionByKey((await context.params).provider);
  if (!connection) return finish("fout", "Onbekend platform.");

  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const stored = request.cookies.get(SOCIAL_STATE_COOKIE)?.value ?? "";
  if (!state || !sameValue(`${state}.${admin.id}`, stored) || !state.startsWith(`${connection.key}.`)) {
    return finish("fout", "De koppeling is verlopen of kwam niet van dit portaal. Probeer het opnieuw.");
  }
  if (params.get("error")) return finish("fout", `${connection.label}: toestemming is niet gegeven.`);
  const code = params.get("code");
  if (!code) return finish("fout", `${connection.label} gaf geen code terug.`);

  try {
    const accounts = await connection.exchange(code, socialRedirectUri(connection.key));
    const saved = await saveConnectedAccounts(accounts, admin.id);
    return finish("verbonden", saved.map((account) => account.displayName).join(", "));
  } catch (error) {
    return finish("fout", error instanceof Error ? error.message : "Koppelen is mislukt.");
  }
}
