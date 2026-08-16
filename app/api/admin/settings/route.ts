import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getSettings, setSetting } from "@/lib/settings";

const SETTING_KEYS = [
  "postnl.customerCode",
  "postnl.customerNumber",
  "postnl.collectionLocation",
  "postnl.barcodeSerie",
  "postnl.senderName",
  "postnl.senderStreet",
  "postnl.senderHouseNumber",
  "postnl.senderPostalCode",
  "postnl.senderCity",
  "postnl.senderCountry",
];

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return (await verifyAdminSessionToken(token)) !== null;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const settings = await getSettings(SETTING_KEYS);
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const entries = Object.entries(body as Record<string, unknown>).filter(
    (entry): entry is [string, string] =>
      SETTING_KEYS.includes(entry[0]) && typeof entry[1] === "string"
  );

  if (entries.length === 0) {
    return NextResponse.json({ error: "NO_VALID_FIELDS" }, { status: 400 });
  }

  for (const [key, value] of entries) {
    await setSetting(key, value.trim());
  }

  return NextResponse.json({ ok: true });
}
