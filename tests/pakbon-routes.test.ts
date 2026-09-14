import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getPakbon } from "../app/api/admin/orders/[id]/pakbon/route";
import { POST as postPakbonBatch } from "../app/api/admin/orders/pakbon/route";

async function main() {
  const singleResponse = await getPakbon(
    new NextRequest("http://localhost/api/admin/orders/missing/pakbon"),
    { params: Promise.resolve({ id: "missing" }) }
  );
  assert.equal(singleResponse.status, 401, "a single pakbon requires an authenticated admin");

  const batchResponse = await postPakbonBatch(
    new NextRequest("http://localhost/api/admin/orders/pakbon", {
      method: "POST",
      body: JSON.stringify({ from: "2026-01-01", to: "2026-01-02" }),
    })
  );
  assert.equal(batchResponse.status, 401, "a batch of pakbonnen requires an authenticated admin");

  console.log("pakbon routes auth test passed");
}

void main();
