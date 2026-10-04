import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "../lib/admin-auth";
import { PATCH as patchBusinessAccount } from "../app/api/admin/business-accounts/[id]/route";

function requireLocalQa(): void {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55435");
  assert.equal(url.pathname, "/notenman_release_qa");
}

test("business customer-number migration is additive, stable and preserves manual numbers", () => {
  const source = readFileSync(
    "prisma/migrations/20261004120000_add_business_customer_number_sequence/migration.sql",
    "utf8",
  );

  assert.match(source, /CREATE SEQUENCE IF NOT EXISTS/);
  assert.match(source, /ROW_NUMBER\(\) OVER \(ORDER BY "createdAt" ASC, "id" ASC\)/);
  assert.match(source, /WHERE "customerNumber" IS NULL/);
  assert.match(source, /AND account\."customerNumber" IS NULL/);
  assert.doesNotMatch(source, /DROP\s+(?:TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/iu);
});

test("concurrent business-account creation receives unique database-owned ZK numbers", async () => {
  requireLocalQa();
  const suffix = randomUUID();
  const created = await Promise.all(
    Array.from({ length: 12 }, (_, index) => prisma.businessAccount.create({
      data: {
        companyName: `QA klantnummer ${index}`,
        contactName: "Release QA",
        email: `${suffix}-${index}@example.invalid`,
      },
      select: { id: true, customerNumber: true },
    })),
  );

  try {
    const numbers = created.map((account) => account.customerNumber);
    assert.equal(new Set(numbers).size, created.length);
    for (const number of numbers) assert.match(number, /^ZK-\d{5,}$/u);
  } finally {
    await prisma.businessAccount.deleteMany({
      where: { id: { in: created.map((account) => account.id) } },
    });
  }
});

test("an old admin bundle may resend customerNumber without rewriting it", async () => {
  requireLocalQa();
  const suffix = randomUUID();
  const admin = await prisma.adminUser.create({
    data: { username: `customer-number-${suffix}`, passwordHash: "unused", name: "Release QA", role: "OWNER" },
  });
  const account = await prisma.businessAccount.create({
    data: { companyName: "Oude bundel", contactName: "Release QA", email: `${suffix}@example.invalid` },
  });
  const token = await createAdminSessionToken(admin.id);

  try {
    const request = new NextRequest(`http://localhost:3105/api/admin/business-accounts/${account.id}`, {
      method: "PATCH",
      headers: {
        cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
        origin: "http://localhost:3105",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        companyName: "Oude bundel bijgewerkt",
        customerNumber: account.customerNumber,
      }),
    });
    const response = await patchBusinessAccount(request, { params: Promise.resolve({ id: account.id }) });
    assert.equal(response.status, 200);
    const updated = await prisma.businessAccount.findUniqueOrThrow({ where: { id: account.id } });
    assert.equal(updated.companyName, "Oude bundel bijgewerkt");
    assert.equal(updated.customerNumber, account.customerNumber);
  } finally {
    await prisma.auditLog.deleteMany({ where: { adminUserId: admin.id } });
    await prisma.businessAccount.delete({ where: { id: account.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
  }
});
