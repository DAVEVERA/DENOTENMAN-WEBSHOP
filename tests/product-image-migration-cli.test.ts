import assert from "node:assert/strict";
import test from "node:test";
import { parseMigrationArguments } from "../scripts/migrate-product-images";

test("migration CLI defaults to dry-run and accepts the required selectors", () => {
  assert.deepEqual(parseMigrationArguments(["--limit=10", "--product-id=product_123", "--resume"]), {
    dryRun: true,
    limit: 10,
    productId: "product_123",
    resume: true,
    force: false,
    reportPath: undefined,
  });
});

test("migration CLI requires explicit apply and keeps force mutually exclusive with resume", () => {
  assert.deepEqual(parseMigrationArguments(["--apply", "--force", "--report=output/run.json"]), {
    dryRun: false,
    limit: undefined,
    productId: undefined,
    resume: false,
    force: true,
    reportPath: "output/run.json",
  });
  assert.throws(() => parseMigrationArguments(["--dry-run", "--apply"]));
  assert.throws(() => parseMigrationArguments(["--force"]));
  assert.throws(() => parseMigrationArguments(["--resume", "--force", "--apply"]));
  assert.throws(() => parseMigrationArguments(["--limit=0"]));
});
