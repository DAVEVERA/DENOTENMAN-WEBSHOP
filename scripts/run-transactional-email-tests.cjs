const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { assertDatabaseAccess } = require("../lib/database-access.cjs");

loadEnvConfig(process.cwd(), false);
assertDatabaseAccess(process.env, "test");

const inheritedOptions = process.env.NODE_OPTIONS?.trim();
const nodeOptions = [inheritedOptions, "--conditions=react-server"].filter(Boolean).join(" ");
const testFiles = [
  "tests/aftersales-test-sample.test.ts",
  "tests/test-order-confirmation-delivery.test.ts",
  "tests/merchant-order-notification.test.ts",
  "tests/transactional-email-provider.test.ts",
  "tests/transactional-email-log.integration.test.ts",
  "tests/mailchimp-transactional-webhook.test.ts",
];

const result = spawnSync(
  process.execPath,
  [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "--test", ...testFiles],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    stdio: "inherit",
  }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
