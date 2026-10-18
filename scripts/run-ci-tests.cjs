const { spawnSync } = require("node:child_process");

// Deterministic, database-independent release checks. Database integration
// suites remain in run-release-tests.cjs and require the isolated QA database.
const files = [
  "tests/admin-product-accessibility.test.tsx",
  "tests/aftersales-flow-trigger-growth.test.ts",
  "tests/aftersales-schema.test.ts",
  "tests/business-portal.test.ts",
  "tests/cache-versioning.test.ts",
  "tests/compact-header.test.tsx",
  "tests/google-reviews.test.ts",
  "tests/home-landing-products.test.ts",
  "tests/homepage-static-hero.test.ts",
  "tests/image-migration-job.test.ts",
  "tests/invoice-template-editor.test.tsx",
  "tests/mailchimp-newsletter-template.test.ts",
  "tests/product-browser-progressive.test.ts",
  "tests/product-image-crop-fallback.test.ts",
  "tests/product-image-migration-core.test.ts",
  "tests/product-image-migration-report.test.ts",
  "tests/product-image-studio-markup.test.tsx",
  "tests/product-image-studio.test.ts",
  "tests/review-dashboard-widgets.test.ts",
  "tests/review-request-button.test.tsx",
  "tests/review-request-content.test.ts",
  "tests/review-request-dispatch.test.ts",
  "tests/review-request-eligibility.test.ts",
  "tests/review-request-email.test.ts",
  "tests/review-request-registry.test.ts",
  "tests/review-request-settings.test.ts",
  "tests/review-request-worklist.test.ts",
  "tests/storefront-image-scan.test.ts",
  "tests/storefront-performance-markup.test.tsx",
];

const result = spawnSync(
  process.execPath,
  ["--require", "./scripts/test-server-only.cjs", "--import", "tsx", "--test", "--test-concurrency=1", ...files],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
