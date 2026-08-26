import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import nextConfig from "../next.config";

const nextConfigSource = readFileSync("next.config.ts", "utf8");
const dockerfileSource = readFileSync("Dockerfile", "utf8");
const cloudBuildSource = readFileSync("cloudbuild-trigger.yaml", "utf8");

test("storefront documents revalidate in browsers without disabling shared performance caching", async () => {
  const headerRules = await nextConfig.headers?.();
  const storefrontRule = headerRules?.find(
    (rule) => rule.source === "/:locale(nl|en|fr)/:path*",
  );

  assert.ok(storefrontRule);
  assert.deepEqual(storefrontRule.missing, [{ type: "header", key: "rsc" }]);
  assert.deepEqual(storefrontRule.headers, [
    {
      key: "Cache-Control",
      value: "public, max-age=0, must-revalidate, s-maxage=60",
    },
  ]);
});

test("admin documents and APIs are never served from a browser or shared cache", async () => {
  const headerRules = await nextConfig.headers?.();
  const expected = "private, no-store, max-age=0, must-revalidate";

  for (const source of ["/admin/:path*", "/api/admin/:path*"]) {
    const rule = headerRules?.find((candidate) => candidate.source === source);
    assert.ok(rule, `Missing cache rule for ${source}`);
    assert.deepEqual(rule.headers, [{ key: "Cache-Control", value: expected }]);
  }
});

test("production builds embed the immutable commit as the Next deployment identifier", () => {
  assert.match(
    nextConfigSource,
    /deploymentId:\s*process\.env\.DEPLOYMENT_VERSION\?\.trim\(\)\s*\|\|\s*undefined/,
  );
  assert.match(
    dockerfileSource,
    /ARG DEPLOYMENT_VERSION[\s\S]*ENV DEPLOYMENT_VERSION=\$DEPLOYMENT_VERSION[\s\S]*RUN npm run build/,
  );
  assert.match(
    cloudBuildSource,
    /--build-arg DEPLOYMENT_VERSION="\$\{_COMMIT_SHA\}"/,
  );
});
