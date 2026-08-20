import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizePhotoRoomInput, PhotoRoomError, runPhotoRoomEdit } from "../lib/design-studio/photoroom-provider";

async function png(width = 12, height = 8) {
  return sharp({ create: { width, height, channels: 4, background: "#e0b200" } }).png().toBuffer();
}

test("PhotoRoom adapter normalizes input and sends only the supported editing contract", async () => {
  const previous = process.env.PHOTOROOM_API_KEY;
  process.env.PHOTOROOM_API_KEY = "test-secret";
  let captured: RequestInit | undefined;
  try {
    const result = await runPhotoRoomEdit(await png(), {
      productId: "product_1",
      imageId: "image_1",
      background: "brand",
      format: "portrait",
      padding: 0.15,
      softShadow: true,
    }, async (_input, init) => {
      captured = init;
      return new Response(await png(24, 30), { status: 200, headers: { "content-type": "image/png", "x-request-id": "provider_1" } });
    });
    const form = captured?.body as FormData;
    assert.equal((captured?.headers as Record<string, string>)["x-api-key"], "test-secret");
    assert.equal(form.get("background.color"), "F6F3EE");
    assert.equal(form.get("outputSize"), "1200x1500");
    assert.equal(form.get("padding"), "0.15");
    assert.equal(form.get("shadow.mode"), "ai.soft");
    assert.equal(result.contentType, "image/webp");
    assert.equal(result.providerRequestId, "provider_1");
    assert.equal(result.width, 24);
    assert.equal(result.height, 30);
  } finally {
    if (previous === undefined) delete process.env.PHOTOROOM_API_KEY;
    else process.env.PHOTOROOM_API_KEY = previous;
  }
});

test("PhotoRoom adapter rejects invalid source bytes before a provider call", async () => {
  await assert.rejects(() => normalizePhotoRoomInput(Buffer.from("not-an-image")), (error: unknown) => error instanceof PhotoRoomError && error.code === "INVALID_SOURCE");
});
