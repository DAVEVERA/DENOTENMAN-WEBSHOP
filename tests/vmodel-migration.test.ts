import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("VModel provider migration is additive and the environment contract is documented", () => {
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260826192500_add_vmodel_design_provider/migration.sql"), "utf8");
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  assert.match(migration, /ALTER TYPE "DesignProvider" ADD VALUE IF NOT EXISTS 'VMODEL'/);
  assert.doesNotMatch(migration, /DROP|DELETE|TRUNCATE/i);
  assert.match(schema, /enum DesignProvider\s*{[\s\S]*PHOTOROOM[\s\S]*VMODEL/);
  assert.match(example, /^VMODEL_API_KEY=$/m);
});
