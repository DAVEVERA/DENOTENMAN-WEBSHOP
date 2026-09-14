import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as regeneratePdf } from "../app/api/admin/business-accounts/[id]/invoices/[invoiceId]/regenerate-pdf/route";

async function main() {
  const response = await regeneratePdf(
    new NextRequest(
      "http://localhost/api/admin/business-accounts/missing/invoices/missing/regenerate-pdf",
      { method: "POST" }
    ),
    { params: Promise.resolve({ id: "missing", invoiceId: "missing" }) }
  );

  assert.equal(response.status, 401, "regenerating an invoice PDF requires an authenticated admin");
  console.log("invoice regenerate-pdf route auth test passed");
}

void main();
