import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as regenerateInvoice } from "../app/api/admin/business-accounts/[id]/orders/[orderId]/regenerate-invoice/route";

async function main() {
  const response = await regenerateInvoice(
    new NextRequest("http://localhost/api/admin/business-accounts/missing/orders/missing/regenerate-invoice", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "missing", orderId: "missing" }) }
  );

  assert.equal(response.status, 401, "regenerating an invoice requires an authenticated admin");
  console.log("business invoice regenerate route auth test passed");
}

void main();
