import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as postMarketManifest } from "../app/api/admin/orders/market-manifest/route";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from "../lib/admin-auth";
import { prisma } from "../lib/prisma";

test("market manifest rejects inactive and deleted admins with a valid signed cookie", async () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  const originalFind = prisma.adminUser.findUnique;
  const originalOrders = prisma.order.findMany;
  process.env.ADMIN_SESSION_SECRET = "manifest-test-only-secret";
  let queriedOrders = false;
  try {
    prisma.order.findMany = (async () => { queriedOrders = true; return []; }) as typeof originalOrders;
    const token = await createAdminSessionToken("disabled-admin");
    for (const user of [{ id: "disabled-admin", active: false }, null]) {
      prisma.adminUser.findUnique = (async () => user) as unknown as typeof originalFind;
      const response = await postMarketManifest(new NextRequest("http://localhost/api/admin/orders/market-manifest", {
        method: "POST",
        headers: { origin: "http://localhost", cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
        body: JSON.stringify({ from: "2026-01-01", to: "2026-01-02" }),
      }));
      assert.equal(response.status, 401);
    }
    assert.equal(queriedOrders, false);
  } finally {
    prisma.adminUser.findUnique = originalFind;
    prisma.order.findMany = originalOrders;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

async function main() {
  const response = await postMarketManifest(
    new NextRequest("http://localhost/api/admin/orders/market-manifest", {
      method: "POST",
      body: JSON.stringify({ from: "2026-01-01", to: "2026-01-02" }),
    })
  );
  assert.equal(response.status, 401, "the market manifest requires an authenticated admin");

  console.log("market manifest route auth test passed");
}

void main();
