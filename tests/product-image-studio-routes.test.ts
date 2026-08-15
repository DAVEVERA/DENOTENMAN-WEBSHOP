import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as listImages, POST as uploadImage } from "../app/api/admin/products/[id]/images/route";
import { PATCH as updateImage, DELETE as deleteImage } from "../app/api/admin/products/[id]/images/[imageId]/route";
import { PUT as reorderImages } from "../app/api/admin/products/[id]/images/reorder/route";
import { POST as runStudioOperation } from "../app/api/admin/products/[id]/images/studio/route";

const productContext = { params: Promise.resolve({ id: "product_1" }) };
const imageContext = { params: Promise.resolve({ id: "product_1", imageId: "image_1" }) };

test("every product image API rejects unauthenticated requests before processing input", async () => {
  const responses = await Promise.all([
    listImages(new NextRequest("http://localhost/api/admin/products/product_1/images"), productContext),
    uploadImage(new NextRequest("http://localhost/api/admin/products/product_1/images", { method: "POST" }), productContext),
    updateImage(new NextRequest("http://localhost/api/admin/products/product_1/images/image_1", { method: "PATCH", body: "not-json" }), imageContext),
    deleteImage(new NextRequest("http://localhost/api/admin/products/product_1/images/image_1", { method: "DELETE" }), imageContext),
    reorderImages(new NextRequest("http://localhost/api/admin/products/product_1/images/reorder", { method: "PUT", body: "not-json" }), productContext),
    runStudioOperation(new NextRequest("http://localhost/api/admin/products/product_1/images/studio", { method: "POST", body: "not-json" }), productContext),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401, 401]);
  for (const response of responses) {
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
  }
});
