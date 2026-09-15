import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getConceptInvoice } from "../app/api/admin/business-accounts/[id]/order-lists/[orderListId]/concept-invoice/route";

async function main() {
  const response = await getConceptInvoice(
    new NextRequest("http://localhost/api/admin/business-accounts/missing/order-lists/missing/concept-invoice"),
    { params: Promise.resolve({ id: "missing", orderListId: "missing" }) }
  );

  assert.equal(response.status, 401, "generating a concept invoice requires an authenticated admin");
  console.log("concept invoice route auth test passed");
}

void main();
