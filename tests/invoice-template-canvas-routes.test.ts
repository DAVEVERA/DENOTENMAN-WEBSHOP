import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH as patchCanvas } from "../app/api/admin/marketing/invoice-template/canvas/route";
import { PATCH as patchBlockText } from "../app/api/admin/marketing/invoice-template/block-text/[blockId]/route";

async function main() {
  const canvasResponse = await patchCanvas(
    new NextRequest("http://localhost/api/admin/marketing/invoice-template/canvas", { method: "PATCH", body: JSON.stringify({ rows: [] }) })
  );
  assert.equal(canvasResponse.status, 401, "updating the canvas requires an authenticated admin");

  const blockTextResponse = await patchBlockText(
    new NextRequest("http://localhost/api/admin/marketing/invoice-template/block-text/header", { method: "PATCH", body: JSON.stringify({ key: "header:title", value: "Factuur" }) }),
    { params: Promise.resolve({ blockId: "header" }) }
  );
  assert.equal(blockTextResponse.status, 401, "updating block text requires an authenticated admin");

  console.log("invoice template canvas routes auth test passed");
}

void main();
