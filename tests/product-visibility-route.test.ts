import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH } from "../app/api/admin/products/[id]/visibility/route";

async function main() {
  const response = await PATCH(
    new NextRequest("http://localhost/api/admin/products/product-1/visibility", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false, version: "2026-08-17T12:00:00.000Z" }),
    }),
    { params: Promise.resolve({ id: "product-1" }) }
  );

  assert.equal(response.status, 401, "Product visibility updates must require an admin session");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
