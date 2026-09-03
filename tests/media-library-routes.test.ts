import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as listMedia, POST as uploadMedia } from "../app/api/admin/media/route";
import { PATCH as updateMedia, DELETE as deleteMedia } from "../app/api/admin/media/[id]/route";

const assetContext = { params: Promise.resolve({ id: "media_1" }) };

test("every media library API rejects unauthenticated requests before processing input", async () => {
  const responses = await Promise.all([
    listMedia(new NextRequest("http://localhost/api/admin/media")),
    uploadMedia(new NextRequest("http://localhost/api/admin/media", { method: "POST" })),
    updateMedia(new NextRequest("http://localhost/api/admin/media/media_1", { method: "PATCH", body: "not-json" }), assetContext),
    deleteMedia(new NextRequest("http://localhost/api/admin/media/media_1", { method: "DELETE" }), assetContext),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401]);
  for (const response of responses) {
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
  }
});
