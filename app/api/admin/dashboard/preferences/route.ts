import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { can } from "@/lib/roles";
import { migratePreferences } from "@/lib/dashboard/migrate";
import { packLayout, type DashboardPreferences } from "@/lib/dashboard/schema";
import { getDashboardSource } from "@/lib/dashboard/sources";
import { validatePreferences } from "@/lib/dashboard/validate";
import { getSetting, setSetting } from "@/lib/settings";

export const runtime = "nodejs";

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

/**
 * Drops the widgets this admin's role may not read. The dashboard is personal, but a role
 * that cannot see orders should not be able to keep an order widget from an earlier role.
 */
function withinPermissions(
  preferences: DashboardPreferences,
  role: Parameters<typeof can>[0],
): DashboardPreferences {
  const allowed = preferences.widgets.filter((widget) => {
    const source = getDashboardSource(widget.source);
    if (!source) return false;
    // Analytics has no resource of its own yet; reading orders is the closest existing right.
    const resource = source.permission.resource === "analytics" ? "orders" : source.permission.resource;
    return can(role, resource, source.permission.action);
  });
  return { ...preferences, widgets: packLayout(allowed) };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const raw = await getSetting(settingKey(admin.id));
  let stored: unknown = null;
  try {
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  const migration = migratePreferences(stored);
  // Writing the migrated shape back once keeps the next read cheap and the stored data current.
  if (migration.changed && raw !== null) {
    await setSetting(settingKey(admin.id), JSON.stringify(migration.preferences)).catch(() => undefined);
  }

  return NextResponse.json(
    { ...withinPermissions(migration.preferences, admin.role), hiddenDuplicates: migration.hiddenDuplicates },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await readLimitedJson(request, 200_000);
  if (!body.ok && body.tooLarge) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  if (!body.ok) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const validated = validatePreferences(body.value);
  if (!validated.ok) {
    return NextResponse.json({ error: "INVALID_PREFERENCES", problems: validated.problems }, { status: 400 });
  }

  // A widget may only come from a source this role is allowed to read, whatever the browser sent.
  for (const widget of validated.widgets) {
    const source = getDashboardSource(widget.source)!;
    const resource = source.permission.resource === "analytics" ? "orders" : source.permission.resource;
    if (!can(admin.role, resource, source.permission.action)) {
      return NextResponse.json({ error: "FORBIDDEN_SOURCE", problems: [{ field: `${widget.id}.source`, message: `Je mag ${source.label} niet bekijken.` }] }, { status: 403 });
    }
    // A shared template is a separate right; personal dashboards cannot create one.
    if (widget.scope === "shared" && !can(admin.role, "users", "write")) {
      return NextResponse.json({ error: "FORBIDDEN_SCOPE", problems: [{ field: `${widget.id}.scope`, message: "Alleen een beheerder met gebruikersrechten kan een gedeelde widget maken." }] }, { status: 403 });
    }
  }

  const preferences: DashboardPreferences = { version: 2, widgets: packLayout(validated.widgets) };
  await setSetting(settingKey(admin.id), JSON.stringify(preferences));
  return NextResponse.json({ ok: true, preferences });
}
