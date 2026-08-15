import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/admin/products/[id]/audit/route";
import { POST as apply } from "../app/api/admin/products/[id]/audit/apply/route";

async function main() {
  const params = { params: Promise.resolve({ id: "product-1" }) };

  const getResponse = await GET(new NextRequest("http://localhost/api/admin/products/product-1/audit"), params);
  assert.equal(getResponse.status, 401, "deterministic audit endpoint must reject requests without an admin session");

  const generateResponse = await POST(
    new NextRequest("http://localhost/api/admin/products/product-1/audit", { method: "POST" }),
    params
  );
  assert.equal(generateResponse.status, 401, "OpenAI generation endpoint must reject requests without an admin session");

  const applyResponse = await apply(
    new NextRequest("http://localhost/api/admin/products/product-1/audit/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    params
  );
  assert.equal(applyResponse.status, 401, "proposal application endpoint must reject requests without an admin session");

  console.log("product audit route tests: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
