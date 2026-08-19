import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH as updateFlow } from "../app/api/admin/marketing/aftersales/route";
import { POST as sendTest } from "../app/api/admin/marketing/aftersales/test/route";
import { POST as retryEmail } from "../app/api/admin/marketing/email-logboek/[id]/retry/route";

async function main() {
  const updateResponse = await updateFlow(new NextRequest(
    "http://localhost/api/admin/marketing/aftersales",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }
  ));
  const testResponse = await sendTest(new NextRequest(
    "http://localhost/api/admin/marketing/aftersales/test",
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
  ));
  const retryResponse = await retryEmail(
    new NextRequest("http://localhost/api/admin/marketing/email-logboek/missing/retry", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "missing" }) }
  );

  assert.equal(updateResponse.status, 401, "flow updates require an authenticated admin");
  assert.equal(testResponse.status, 401, "test sends require an authenticated admin");
  assert.equal(retryResponse.status, 401, "email retries require an authenticated admin");
  console.log("aftersales admin route auth tests passed");
}

void main();
