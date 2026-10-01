import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";

import { GET } from "../app/api/admin/invoices/export/route";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "../lib/admin-auth";
import { prisma } from "../lib/prisma";

const run = randomUUID().slice(0, 8);
let adminId = "";
let userId = "";
let cookie = "";
const previousSecret = process.env.ADMIN_SESSION_SECRET;

function request(query: string, withCookie = true) {
  return new NextRequest(`http://localhost/api/admin/invoices/export?${query}`, { headers: withCookie ? { cookie: `${ADMIN_SESSION_COOKIE}=${cookie}` } : {} });
}

async function rowsFor(query: string): Promise<string[]> {
  const response = await GET(request(query));
  assert.equal(response.status, 200);
  return (await response.text()).replace(/^﻿/u, "").split("\n").filter((line) => line.includes(run));
}

before(async () => {
  process.env.ADMIN_SESSION_SECRET ||= "integration-test-admin-secret";
  const admin = await prisma.adminUser.create({ data: { username: `export-test-${run}`, passwordHash: "x", name: "Export test", role: "ADMIN" } });
  adminId = admin.id;
  cookie = await createAdminSessionToken(admin.id);
  const user = await prisma.user.create({ data: { email: `export-${run}@example.com`, name: "Export test" } });
  userId = user.id;
  const order = (name: string, country: string, createdAt: string, status: "PAID" | "FULFILLED" | "PENDING", isTest = false) => prisma.order.create({
    data: { userId, status, isTest, subtotalCents: 1_000, totalCents: 1_000, contactName: `${name} ${run}`, contactEmail: `klant-${run}@example.com`, shippingCountry: country, createdAt: new Date(createdAt) },
  });
  await order("NL-september", "NL", "2026-09-15T10:00:00Z", "PAID");
  // 30 September 23:30 in Amsterdam: still September.
  await order("NL-laat-september", "NL", "2026-09-30T21:30:00Z", "FULFILLED");
  await order("NL-oktober", "NL", "2026-10-02T10:00:00Z", "PAID");
  await order("BE-september", "BE", "2026-09-20T10:00:00Z", "PAID");
  await order("NL-onbetaald", "NL", "2026-09-16T10:00:00Z", "PENDING");
  await order("NL-test", "NL", "2026-09-17T10:00:00Z", "PAID", true);
});

after(async () => {
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.adminUser.deleteMany({ where: { id: adminId } });
  process.env.ADMIN_SESSION_SECRET = previousSecret;
});

test("the export needs an admin session and a valid period", async () => {
  assert.equal((await GET(request("type=particulier", false))).status, 401);
  assert.equal((await GET(request("type=particulier&periode=2026-13"))).status, 400);
});

test("private orders export per country and per period, in Dutch time", async () => {
  const septemberNl = await rowsFor("type=particulier&country=NL&periode=2026-09");
  assert.deepEqual(septemberNl.map((line) => line.split(",")[2]), [`NL-september ${run}`, `NL-laat-september ${run}`], "unpaid and test orders are left out");

  const q3All = await rowsFor("type=particulier&periode=2026-Q3");
  assert.equal(q3All.length, 3, "both countries in the quarter");

  const october = await rowsFor("type=particulier&periode=2026-10");
  assert.equal(october.length, 1);

  const response = await GET(request("type=particulier&country=BE&periode=2026-H2"));
  assert.match(response.headers.get("content-disposition") ?? "", /facturen-particulier-be-2026-h2\.csv/u);
});

test("the combined export contains private orders next to business invoices", async () => {
  const rows = await rowsFor("type=alle&periode=2026");
  assert.equal(rows.length, 4);
  assert.ok(rows.every((line) => line.startsWith("Particulier,")));
});
