import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { hasSameOrigin } from "@/lib/design-studio/http";
import {
  saveThemePresetInputSchema,
  savedThemePresetsSchema,
  upsertThemePreset,
  type NewsletterThemePreset,
} from "@/lib/newsletter/theme-presets";
import { getSetting, setSetting } from "@/lib/settings";

export const runtime = "nodejs";

const SETTING_KEY = "newsletter.themePresets";
const noStore = { "cache-control": "no-store" };

async function readPresets(): Promise<NewsletterThemePreset[]> {
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return [];
  try {
    const parsed = savedThemePresetsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// House styles saved from the newsletter editor, shared by every admin.
export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ presets: await readPresets() }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = saveThemePresetInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Controleer de huisstijl." }, { status: 422 });
  }
  const presets = upsertThemePreset(await readPresets(), parsed.data.name, parsed.data.theme);
  await setSetting(SETTING_KEY, JSON.stringify(presets));
  return NextResponse.json({ presets }, { headers: noStore });
}

export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession(request))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const presets = (await readPresets()).filter((preset) => preset.id !== id);
  await setSetting(SETTING_KEY, JSON.stringify(presets));
  return NextResponse.json({ presets }, { headers: noStore });
}
