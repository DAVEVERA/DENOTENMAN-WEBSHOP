import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from "../lib/admin-auth";
import { PATCH } from "../app/api/admin/marketing/invoice-template/blocks/[key]/route";

// Authenticated PATCH routes in this codebase are tested against a real
// admin session (see tests/business-notifications-db.integration.test.ts and
// tests/admin-product-flow.integration.ts): create a real AdminUser, mint a
// real session token with createAdminSessionToken, and attach it as the
// admin session cookie on a NextRequest.
async function withAdminCookie<T>(run: (cookie: string) => Promise<T>): Promise<T> {
  const admin = await prisma.adminUser.create({
    data: { username: `invoice-template-qa-${randomUUID()}`, passwordHash: "unused", name: "QA" },
  });
  try {
    const cookie = `${ADMIN_SESSION_COOKIE}=${await createAdminSessionToken(admin.id)}`;
    return await run(cookie);
  } finally {
    await prisma.adminUser.delete({ where: { id: admin.id } });
  }
}

test("rejects a textOverrides key not on that block's allowlist", async () => {
  await prisma.invoiceTemplateBlock.deleteMany({});
  await prisma.invoiceTemplate.deleteMany({});

  await withAdminCookie(async (cookie) => {
    const request = new NextRequest("http://localhost/api/admin/marketing/invoice-template/blocks/totals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ x: 0, y: 0, width: 100, height: 40, textOverrides: { notAllowed: "x" } }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ key: "totals" }) });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.error, "INVALID_TEXT_KEY");
  });
});

test("rejects an unknown block key", async () => {
  await withAdminCookie(async (cookie) => {
    const request = new NextRequest("http://localhost/api/admin/marketing/invoice-template/blocks/notarealkey", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ x: 0, y: 0, width: 100, height: 40, textOverrides: null }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ key: "notarealkey" }) });
    assert.equal(response.status, 400);
  });
});
