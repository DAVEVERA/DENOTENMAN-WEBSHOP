import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(
  join(process.cwd(), "app/admin/(dashboard)/design-studio/mediabibliotheek/page.tsx"),
  "utf8",
);

test("Design Studio media library requires an authenticated, active admin", () => {
  assert.match(pageSource, /verifyAdminSessionToken/);
  assert.match(pageSource, /redirect\("\/admin\/login"\)/);
  assert.match(pageSource, /admin\?\.active/);
});

test("Design Studio media library filters DesignAsset rows by product name, provider and status", () => {
  assert.match(pageSource, /prisma\.designAsset\.count/);
  assert.match(pageSource, /prisma\.designAsset\.findMany/);
  assert.match(pageSource, /job: \{ provider \}/);
  assert.match(pageSource, /translations: \{ some: \{ locale: "nl", name: \{ contains: q, mode: "insensitive" \} \} \}/);
  assert.match(pageSource, /name="q"/);
  assert.match(pageSource, /name="provider"/);
  assert.match(pageSource, /name="status"/);
});

test("Design Studio media library is paginated and links back to the hub", () => {
  assert.match(pageSource, /skip: \(page - 1\) \* PAGE_SIZE/);
  assert.match(pageSource, /take: PAGE_SIZE/);
  assert.match(pageSource, /href="\/admin\/design-studio"/);
  assert.match(pageSource, /Formaat/);
});
