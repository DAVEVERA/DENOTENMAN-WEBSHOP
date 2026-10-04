import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "../lib/admin-auth";
import { PATCH as patchOrder } from "../app/api/admin/orders/[id]/route";
import { POST as createLabel } from "../app/api/admin/orders/[id]/postnl-label/route";
import { POST as createBulkLabels } from "../app/api/admin/orders/postnl-labels/route";

function requireLocalQa(): void {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
}

function request(
  path: string,
  token: string,
  body: unknown,
  origin: string | null = "http://localhost:3105",
): NextRequest {
  const headers = new Headers({
    cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
    "content-type": "application/json",
  });
  if (origin) headers.set("origin", origin);
  return new NextRequest(`http://localhost:3105${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("order mutations reject STAFF, inactive admins and cross-site requests before provider work", async () => {
  requireLocalQa();
  const suffix = randomUUID();
  const [staff, admin, inactive] = await Promise.all([
    prisma.adminUser.create({ data: { username: `staff-${suffix}`, passwordHash: "unused", name: "QA staff", role: "STAFF" } }),
    prisma.adminUser.create({ data: { username: `admin-${suffix}`, passwordHash: "unused", name: "QA admin", role: "ADMIN" } }),
    prisma.adminUser.create({ data: { username: `inactive-${suffix}`, passwordHash: "unused", name: "QA inactive", role: "ADMIN", active: false } }),
  ]);
  const [staffToken, adminToken, inactiveToken] = await Promise.all([
    createAdminSessionToken(staff.id),
    createAdminSessionToken(admin.id),
    createAdminSessionToken(inactive.id),
  ]);

  try {
    const context = { params: Promise.resolve({ id: "does-not-matter" }) };
    assert.equal((await patchOrder(request("/api/admin/orders/does-not-matter", staffToken, { status: "FULFILLED" }), context)).status, 403);
    assert.equal((await patchOrder(request("/api/admin/orders/does-not-matter", inactiveToken, { status: "FULFILLED" }), context)).status, 401);
    assert.equal((await patchOrder(request("/api/admin/orders/does-not-matter", adminToken, { status: "FULFILLED" }, null), context)).status, 403);
    assert.equal((await patchOrder(request("/api/admin/orders/does-not-matter", adminToken, { status: "FULFILLED" }, "https://evil.example"), context)).status, 403);

    assert.equal((await createLabel(request("/api/admin/orders/does-not-matter/postnl-label", staffToken, {}), context)).status, 403);
    assert.equal((await createBulkLabels(request("/api/admin/orders/postnl-labels", staffToken, { from: "2026-10-01", to: "2026-10-02" }))).status, 403);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: { in: [staff.id, admin.id, inactive.id] } } });
  }
});
