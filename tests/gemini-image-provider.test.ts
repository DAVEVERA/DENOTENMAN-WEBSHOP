import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { generateGeminiProductImage, getGeminiImageAvailability, GeminiImageError } from "../lib/design-studio/gemini-image-provider";

async function png(width = 32, height = 24) {
  return sharp({ create: { width, height, channels: 4, background: "#d8b36a" } }).png().toBuffer();
}

test("Gemini Image sends a product-faithful image interaction and normalizes its output", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-secret";
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  try {
    const generated = await generateGeminiProductImage(
      await png(),
      {
        productId: "product_1",
        imageId: "image_1",
        modelId: "gemini-3.1-flash-image",
        preset: "hero",
        aspectRatio: "16:9",
        imageSize: "2K",
        brief: "Zomerse borreltafel met rustige ruimte links",
      },
      "Cashewnoten",
      async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return Response.json({
          id: "interaction_123",
          output_image: { type: "image", mime_type: "image/png", data: (await png(64, 36)).toString("base64") },
        });
      },
    );
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(capturedUrl, "https://generativelanguage.googleapis.com/v1beta/interactions");
    assert.equal((capturedInit?.headers as Record<string, string>)["x-goog-api-key"], "test-secret");
    assert.equal(body.model, "gemini-3.1-flash-image");
    assert.equal(body.store, false);
    assert.equal(body.response_format.aspect_ratio, "16:9");
    assert.equal(body.response_format.image_size, "2K");
    assert.equal(body.input[1].type, "image");
    assert.equal(body.input[1].mime_type, "image/png");
    assert.match(body.input[0].text, /Preserve the exact product identity, packaging, label, logo, colors, proportions, quantity/i);
    assert.match(body.input[0].text, /Do not invent or rewrite labels/i);
    assert.equal(generated.contentType, "image/webp");
    assert.equal(generated.width, 64);
    assert.equal(generated.height, 36);
    assert.equal(generated.providerRequestId, "interaction_123");
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test("Gemini Image availability proves model access without generating an image", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-secret";
  try {
    const ready = await getGeminiImageAvailability(async (_input, init) => {
      assert.equal(init?.method, "GET");
      assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], "test-secret");
      return Response.json({ models: [{ name: "models/gemini-3.1-flash-image" }, { name: "models/gemini-3-pro-image" }] });
    });
    assert.deepEqual(ready, { status: "ready", availableModels: ["gemini-3.1-flash-image", "gemini-3-pro-image"] });

    const rejected = await getGeminiImageAvailability(async () => new Response(null, { status: 403 }));
    assert.deepEqual(rejected, { status: "invalid_configuration", availableModels: [] });
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test("Gemini Image maps a definite provider rejection without exposing provider text", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-secret";
  try {
    const source = await png();
    await assert.rejects(
      () => generateGeminiProductImage(
        source,
        { productId: "p", imageId: "i", modelId: "gemini-3.1-flash-image", preset: "catalog", aspectRatio: "1:1", imageSize: "1K", brief: "" },
        "Amandelen",
        async () => Response.json({ error: { message: "sensitive upstream detail" } }, { status: 400 }),
      ),
      (error: unknown) => error instanceof GeminiImageError && error.code === "PROVIDER_REJECTED" && !error.message.includes("sensitive"),
    );
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
