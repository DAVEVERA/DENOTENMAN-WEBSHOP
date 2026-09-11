import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  assertPhotoRoomAvailable,
  getPhotoRoomAvailability,
  normalizePhotoRoomInput,
  PhotoRoomError,
  runPhotoRoomEdit,
} from "../lib/design-studio/photoroom-provider";

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

test("PhotoRoom availability reports exhausted credits without starting an edit", async () => {
  const previous = process.env.PHOTOROOM_API_KEY;
  process.env.PHOTOROOM_API_KEY = "test-secret";
  const requests: string[] = [];
  try {
    const availability = await getPhotoRoomAvailability(async (input) => {
      requests.push(String(input));
      return Response.json({ images: { available: 0, subscription: 10 }, plan: "unknown" });
    });

    assert.deepEqual(availability, { status: "insufficient_credits", availableCredits: 0, requiredCredits: 5 });
    assert.deepEqual(requests, ["https://image-api.photoroom.com/v2/account"]);
  } finally {
    if (previous === undefined) delete process.env.PHOTOROOM_API_KEY;
    else process.env.PHOTOROOM_API_KEY = previous;
  }
});

test("PhotoRoom availability guard explains exhausted credits", async () => {
  const previous = process.env.PHOTOROOM_API_KEY;
  process.env.PHOTOROOM_API_KEY = "test-secret";
  try {
    await assert.rejects(
      () => assertPhotoRoomAvailable(async () => Response.json({ images: { available: 0, subscription: 10 } })),
      (error: unknown) => error instanceof PhotoRoomError
        && error.code === "CREDITS_EXHAUSTED"
        && error.status === 503
        && /tegoed is onvoldoende/i.test(error.message),
    );
  } finally {
    if (previous === undefined) delete process.env.PHOTOROOM_API_KEY;
    else process.env.PHOTOROOM_API_KEY = previous;
  }
});

test("PhotoRoom availability requires five credits for Basic image editing", async () => {
  const previous = process.env.PHOTOROOM_API_KEY;
  process.env.PHOTOROOM_API_KEY = "test-secret";
  try {
    const availability = await getPhotoRoomAvailability(async () => Response.json({ images: { available: 3 }, plan: "basic" }));
    assert.deepEqual(availability, { status: "insufficient_credits", availableCredits: 3, requiredCredits: 5 });
  } finally {
    if (previous === undefined) delete process.env.PHOTOROOM_API_KEY;
    else process.env.PHOTOROOM_API_KEY = previous;
  }
});
