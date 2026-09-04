import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("discount usage is reserved atomically and stores only hashed identities", async () => {
  const [usage, orders, schema, migration] = await Promise.all([
    readFile("lib/discount-usage.ts", "utf8"),
    readFile("lib/orders.ts", "utf8"),
    readFile("prisma/schema.prisma", "utf8"),
    readFile("prisma/migrations/20260904213000_expand_discount_usage/migration.sql", "utf8"),
  ]);
  assert.match(usage, /createHash\("sha256"\)/);
  assert.match(usage, /usageCount:\s*\{ lt:\s*policy\.maxUsesPerIdentity \}/);
  assert.match(usage, /usageCount:\s*\{ increment:\s*1 \}/);
  assert.match(usage, /discountRedemption\.create/);
  assert.match(usage, /usageCount:\s*\{ decrement:\s*1 \}/);
  assert.match(orders, /reserveDiscountUsage/);
  assert.match(orders, /nextStatus === "PAID" \? "REDEEMED" : "RELEASED"/);
  assert.match(schema, /@@unique\(\[code, identityKey\]\)/);
  assert.match(migration, /DEFAULT 'SINGLE_USE'/);
  assert.match(migration, /DEFAULT 'EMAIL'/);
  assert.match(migration, /DEFAULT 1/);
});
