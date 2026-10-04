import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import { brandLogoUrl } from "@/lib/newsletter/brand-logo";

export const runtime = "nodejs";

const inputSchema = z.object({ variant: z.enum(["dark", "light"]) }).strict();

// The De Notenman logo as an email-safe PNG, dark or white.
export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Kies een donker of licht logo." }, { status: 422 });
  try {
    return NextResponse.json({ logoUrl: await brandLogoUrl(parsed.data.variant) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Newsletter brand logo failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "LOGO_FAILED", message: "Het logo kon niet worden klaargezet." }, { status: 502 });
  }
}
