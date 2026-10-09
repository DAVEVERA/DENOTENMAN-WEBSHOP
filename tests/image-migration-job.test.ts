import assert from "node:assert/strict";
import test from "node:test";
import {
  directDatabaseUrl,
  migrationArguments,
  planFromEnvironment,
} from "../scripts/ops/image-migration-job";

const version = "circle-center-v1";

function environment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

test("a bare execution is a dry run", () => {
  const plan = planFromEnvironment(environment(), version);

  assert.equal(plan.mode, "dry-run");
  assert.equal(plan.force, false);
  assert.ok(migrationArguments(plan, "/tmp/r.json").includes("--dry-run"));
});

test("applying without the matching confirmation token is refused", () => {
  assert.throws(
    () => planFromEnvironment(environment({ IMAGE_MIGRATION_JOB_MODE: "apply" }), version),
    /IMAGE_MIGRATION_JOB_CONFIRM=APPLY-circle-center-v1/
  );
  assert.throws(
    () =>
      planFromEnvironment(
        environment({ IMAGE_MIGRATION_JOB_MODE: "apply", IMAGE_MIGRATION_JOB_CONFIRM: "APPLY" }),
        version
      ),
    /Refusing to write/
  );
});

test("a token for a different processing version does not authorise this one", () => {
  assert.throws(
    () =>
      planFromEnvironment(
        environment({
          IMAGE_MIGRATION_JOB_MODE: "apply",
          IMAGE_MIGRATION_JOB_CONFIRM: "APPLY-circle-center-v0",
        }),
        version
      ),
    /APPLY-circle-center-v1/
  );
});

test("applying with the right token resumes instead of reprocessing", () => {
  const plan = planFromEnvironment(
    environment({
      IMAGE_MIGRATION_JOB_MODE: "apply",
      IMAGE_MIGRATION_JOB_CONFIRM: `APPLY-${version}`,
    }),
    version
  );
  const args = migrationArguments(plan, "/tmp/r.json");

  assert.equal(plan.mode, "apply");
  assert.ok(args.includes("--apply"));
  assert.ok(args.includes("--resume"));
  assert.ok(!args.includes("--force"));
});

test("force needs its own token and never rides along with the apply token", () => {
  assert.throws(
    () =>
      planFromEnvironment(
        environment({
          IMAGE_MIGRATION_JOB_MODE: "apply",
          IMAGE_MIGRATION_JOB_FORCE: "true",
          IMAGE_MIGRATION_JOB_CONFIRM: `APPLY-${version}`,
        }),
        version
      ),
    /FORCE-circle-center-v1/
  );

  const plan = planFromEnvironment(
    environment({
      IMAGE_MIGRATION_JOB_MODE: "apply",
      IMAGE_MIGRATION_JOB_FORCE: "true",
      IMAGE_MIGRATION_JOB_CONFIRM: `FORCE-${version}`,
    }),
    version
  );
  const args = migrationArguments(plan, "/tmp/r.json");

  assert.ok(args.includes("--force"));
  // The migration script rejects --resume together with --force.
  assert.ok(!args.includes("--resume"));
});

test("force is meaningless in dry-run and is rejected rather than ignored", () => {
  assert.throws(
    () => planFromEnvironment(environment({ IMAGE_MIGRATION_JOB_FORCE: "true" }), version),
    /requires IMAGE_MIGRATION_JOB_MODE=apply/
  );
});

test("an unrecognised mode is rejected rather than treated as a dry run", () => {
  assert.throws(
    () => planFromEnvironment(environment({ IMAGE_MIGRATION_JOB_MODE: "APPLY" }), version),
    /must be either "dry-run" or "apply"/
  );
});

test("limit and product id are validated before the catalogue is touched", () => {
  for (const limit of ["0", "1001", "ten", "1.5"]) {
    assert.throws(
      () => planFromEnvironment(environment({ IMAGE_MIGRATION_JOB_LIMIT: limit }), version),
      /between 1 and 1000/,
      `expected ${limit} to be rejected`
    );
  }
  assert.throws(
    () =>
      planFromEnvironment(
        environment({ IMAGE_MIGRATION_JOB_PRODUCT_ID: "../../etc/passwd" }),
        version
      ),
    /invalid characters/
  );

  const plan = planFromEnvironment(
    environment({ IMAGE_MIGRATION_JOB_LIMIT: "5", IMAGE_MIGRATION_JOB_PRODUCT_ID: "cmt2sch430008wkagszbowa7l" }),
    version
  );
  const args = migrationArguments(plan, "/tmp/r.json");

  assert.ok(args.includes("--limit=5"));
  assert.ok(args.includes("--product-id=cmt2sch430008wkagszbowa7l"));
});

test("a report prefix cannot escape the ops namespace or reach product objects", () => {
  for (const prefix of [
    "ops/../../products",
    "products",
    "products/by-id",
    "ops",
    "ops//image-migration",
    "ops/image migration",
  ]) {
    assert.throws(
      () =>
        planFromEnvironment(environment({ IMAGE_MIGRATION_JOB_REPORT_PREFIX: prefix }), version),
      /ops\/<name> path of safe path segments/,
      `expected ${prefix} to be rejected`
    );
  }

  assert.equal(
    planFromEnvironment(
      environment({ IMAGE_MIGRATION_JOB_REPORT_PREFIX: "ops/image-migration-canary" }),
      version
    ).reportPrefix,
    "ops/image-migration-canary"
  );
});

test("reports are grouped under the Cloud Run execution that produced them", () => {
  const plan = planFromEnvironment(
    environment({ CLOUD_RUN_EXECUTION: "denotenman-image-migration-abcde" }),
    version
  );

  assert.equal(plan.executionId, "denotenman-image-migration-abcde");
  assert.equal(plan.reportPrefix, "ops/image-migration");
});

test("the pooled Neon endpoint is swapped for the direct one", () => {
  assert.equal(
    directDatabaseUrl("postgresql://u:p@ep-x-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require"),
    "postgresql://u:p@ep-x.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require"
  );
  // Secret payloads often carry a trailing newline; a URL never does.
  assert.equal(
    directDatabaseUrl("postgresql://u:p@ep-x.c-6.eu-central-1.aws.neon.tech/neondb\n"),
    "postgresql://u:p@ep-x.c-6.eu-central-1.aws.neon.tech/neondb"
  );
});
