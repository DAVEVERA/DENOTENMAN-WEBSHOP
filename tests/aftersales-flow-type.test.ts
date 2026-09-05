import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { backfillAftersalesFlows } from "../lib/aftersales/defaults";

test("creates the ZAKELIJK flow with both business steps when only PARTICULIER exists", async () => {
  const flowDelegate = prisma.aftersalesFlow as unknown as {
    findMany: (...args: unknown[]) => unknown;
    createMany: (...args: unknown[]) => unknown;
  };
  const originalFindMany = flowDelegate.findMany;
  const originalCreateMany = flowDelegate.createMany;
  let createdFlows: unknown;
  flowDelegate.findMany = async () => [{ flowType: "PARTICULIER" }];
  flowDelegate.createMany = async ({ data }: { data: unknown }) => {
    createdFlows = data;
    return { count: Array.isArray(data) ? data.length : 1 };
  };
  const original = process.env.RELEASE_EXPANDED_ENUM_WRITES;
  process.env.RELEASE_EXPANDED_ENUM_WRITES = "true";
  try {
    const result = await backfillAftersalesFlows();
    assert.equal(result, true);
    assert.deepEqual(createdFlows, [{ name: "Zakelijk", flowType: "ZAKELIJK", isActive: false }]);
  } finally {
    flowDelegate.findMany = originalFindMany;
    flowDelegate.createMany = originalCreateMany;
    process.env.RELEASE_EXPANDED_ENUM_WRITES = original;
  }
});

test("does nothing when both flow types already exist", async () => {
  const flowDelegate = prisma.aftersalesFlow as unknown as { findMany: (...args: unknown[]) => unknown };
  const original = flowDelegate.findMany;
  flowDelegate.findMany = async () => [{ flowType: "PARTICULIER" }, { flowType: "ZAKELIJK" }];
  const envOriginal = process.env.RELEASE_EXPANDED_ENUM_WRITES;
  process.env.RELEASE_EXPANDED_ENUM_WRITES = "true";
  try {
    assert.equal(await backfillAftersalesFlows(), false);
  } finally {
    flowDelegate.findMany = original;
    process.env.RELEASE_EXPANDED_ENUM_WRITES = envOriginal;
  }
});
