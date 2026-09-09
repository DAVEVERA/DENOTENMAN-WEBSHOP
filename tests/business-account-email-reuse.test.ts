import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "prisma/migrations/20260909120000_allow_reuse_deleted_business_email/migration.sql",
);

test("a deleted business account releases its email for one new active account", () => {
  assert.ok(existsSync(migrationPath), "the active-email uniqueness migration is missing");

  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE "BusinessAccount" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL,
      "deletedAt" TEXT
    );
    CREATE UNIQUE INDEX "BusinessAccount_email_key" ON "BusinessAccount"("email");
    INSERT INTO "BusinessAccount" ("id", "email", "deletedAt")
    VALUES ('deleted', 'kaaskraam@example.test', '2026-09-09T10:00:00.000Z');
  `);

  database.exec(readFileSync(migrationPath, "utf8"));
  database.exec(`
    INSERT INTO "BusinessAccount" ("id", "email", "deletedAt")
    VALUES ('active', 'kaaskraam@example.test', NULL);
  `);

  assert.throws(
    () =>
      database.exec(`
        INSERT INTO "BusinessAccount" ("id", "email", "deletedAt")
        VALUES ('second-active', 'KAASKRAAM@example.test', NULL);
      `),
    /UNIQUE constraint failed/,
  );
});

test("business login lookups exclude soft-deleted accounts", () => {
  for (const relativePath of [
    "lib/business-portal.ts",
    "lib/business-password-auth.ts",
    "app/api/business/auth/google/callback/route.ts",
  ]) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    const emailLookup = source.match(
      /businessAccount\.findFirst\(\{[\s\S]*?where:\s*\{[\s\S]*?email:[\s\S]*?\}[\s\S]*?\}\s*,?\s*\}\)/,
    )?.[0];

    assert.ok(emailLookup, `${relativePath} must contain a business-account email lookup`);
    assert.match(emailLookup, /deletedAt:\s*null/, `${relativePath} must ignore deleted accounts`);
  }
});

test("restoring a deleted account reports an email conflict instead of failing generically", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/admin/business-accounts/[id]/restore/route.ts"),
    "utf8",
  );

  assert.match(source, /PrismaClientKnownRequestError/);
  assert.match(source, /error\.code === "P2002"/);
  assert.match(source, /EMAIL_ALREADY_EXISTS/);
});
