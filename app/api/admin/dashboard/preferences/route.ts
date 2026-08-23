import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import {
  DASHBOARD_WIDGET_SOURCES,
  DEFAULT_DASHBOARD_PREFERENCES,
  type DashboardPreferences,
  type DashboardWidgetConfig,
} from "@/lib/admin-dashboard-contract";
import { getSetting, setSetting } from "@/lib/settings";

export const runtime = "nodejs";

const widgetSourceSchema = z.enum(
  DASHBOARD_WIDGET_SOURCES.map((item) => item.source) as [
    DashboardWidgetConfig["source"],
    ...DashboardWidgetConfig["source"][],
  ]
);

const preferencesSchema = z.object({
  version: z.literal(1),
  widgets: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
        source: widgetSourceSchema,
        title: z.string().max(80),
        text: z.string().max(240),
        display: z.enum(["number", "chart"]),
        hidden: z.boolean(),
        custom: z.boolean(),
      })
    )
    .max(40),
});

function settingKey(adminId: string) {
  return `admin.dashboard.preferences.${adminId}`;
}

async function readLimitedJson(
  request: NextRequest,
  maxBytes: number
): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  if (!request.body) return { ok: false, tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(combined)) as unknown };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

function mergePreferences(saved: DashboardPreferences): DashboardPreferences {
  const defaults = new Map(
    DEFAULT_DASHBOARD_PREFERENCES.widgets.map((widget) => [widget.id, widget])
  );
  const merged: DashboardWidgetConfig[] = [];
  const seen = new Set<string>();

  for (const widget of saved.widgets) {
    if (seen.has(widget.id)) continue;
    if (!widget.custom && !defaults.has(widget.id)) continue;
    merged.push(widget);
    seen.add(widget.id);
  }
  for (const widget of DEFAULT_DASHBOARD_PREFERENCES.widgets) {
    if (!seen.has(widget.id)) merged.push(widget);
  }
  return { version: 1, widgets: merged };
}

async function loadPreferences(adminId: string): Promise<DashboardPreferences> {
  const raw = await getSetting(settingKey(adminId));
  if (!raw) return DEFAULT_DASHBOARD_PREFERENCES;
  try {
    const parsed = preferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? mergePreferences(parsed.data) : DEFAULT_DASHBOARD_PREFERENCES;
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const preferences = await loadPreferences(admin.id);
  return NextResponse.json(preferences, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const bodyResult = await readLimitedJson(request, 50_000);
  if (!bodyResult.ok && bodyResult.tooLarge) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  if (!bodyResult.ok) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const parsed = preferencesSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PREFERENCES" }, { status: 400 });
  }
  const ids = parsed.data.widgets.map((widget) => widget.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "DUPLICATE_WIDGET_ID" }, { status: 400 });
  }

  const preferences = mergePreferences(parsed.data);
  await setSetting(settingKey(admin.id), JSON.stringify(preferences));
  return NextResponse.json({ ok: true, preferences });
}
