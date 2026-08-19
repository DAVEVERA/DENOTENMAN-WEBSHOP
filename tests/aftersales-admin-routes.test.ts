import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH as updateFlow } from "../app/api/admin/marketing/aftersales/route";
import { POST as sendTest } from "../app/api/admin/marketing/aftersales/test/route";

async function main() {
  const updateResponse = await updateFlow(new NextRequest(
    "http://localhost/api/admin/marketing/aftersales",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }
  ));
  const testResponse = await sendTest(new NextRequest(
    "http://localhost/api/admin/marketing/aftersales/test",
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
  ));

  assert.equal(updateResponse.status, 401, "flow updates require an authenticated admin");
  assert.equal(testResponse.status, 401, "test sends require an authenticated admin");
  console.log("aftersales admin route auth tests passed");
}

void main();
