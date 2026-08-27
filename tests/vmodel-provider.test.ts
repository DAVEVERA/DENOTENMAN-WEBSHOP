import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createVModelTask, downloadVModelImage, getVModelTask, VModelError } from "../lib/design-studio/vmodel-provider";

async function png(width = 16, height = 10) {
  return sharp({ create: { width, height, channels: 4, background: "#d8b36a" } }).png().toBuffer();
}

test("VModel adapter sends a safe Nano Banana task contract without exposing control over safety", async () => {
  const previous = process.env.VMODEL_API_KEY;
  process.env.VMODEL_API_KEY = "test-secret";
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  try {
    const result = await createVModelTask({
      productId: "product_1",
      imageId: "image_1",
      modelId: "nano-banana-2",
      preset: "hero",
      aspectRatio: "16:9",
      quality: "high",
      brief: "Rustige zomerse borreltafel",
    }, "https://cdn.denotenman.com/product.webp", "Amandelen", async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json({ code: 200, result: { task_id: "task_123", task_cost: 3 } });
    });
    const body = JSON.parse(String(capturedInit?.body));
    assert.equal(capturedUrl, "https://api.vmodel.ai/api/tasks/v1/create");
    assert.equal((capturedInit?.headers as Record<string, string>).Authorization, "Bearer test-secret");
    assert.equal(body.version, "81df2e08a1d61b48f96ca1073fdd8dc68ca68be156e42a7e86c0534a94099a04");
    assert.deepEqual(body.input.img_urls, ["https://cdn.denotenman.com/product.webp"]);
    assert.equal(body.input.resolution, "2K");
    assert.equal(body.input.aspect_ratio, "16:9");
    assert.equal(body.input.disable_safety_checker, false);
    assert.equal(body.input.google_search, false);
    assert.match(body.input.prompt, /Preserve the exact product/);
    assert.match(body.input.prompt, /no text in the image/i);
    assert.deepEqual(result, { providerTaskId: "task_123", taskCost: 3 });
  } finally {
    if (previous === undefined) delete process.env.VMODEL_API_KEY;
    else process.env.VMODEL_API_KEY = previous;
  }
});

test("VModel adapter uses the model-specific Seedream endpoint and input field", async () => {
  const previous = process.env.VMODEL_API_KEY;
  process.env.VMODEL_API_KEY = "test-secret";
  let capturedUrl = "";
  let capturedBody: { input?: { image_input?: string[]; size?: string; sequential_image_generation?: string; disable_safety_checker?: boolean } } = {};
  try {
    await createVModelTask({
      productId: "product_1",
      imageId: "image_1",
      modelId: "seedream-4-5",
      preset: "editorial",
      aspectRatio: "4:5",
      quality: "standard",
      brief: "",
    }, "https://cdn.denotenman.com/product.webp", "Pistachenoten", async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return Response.json({ code: 200, result: { task_id: "seedream_task" } });
    });
    assert.equal(capturedUrl, "https://api.vmodel.ai/api/tasks/v1/bytedance/seedream-4-5/create");
    assert.ok(capturedBody.input);
    assert.deepEqual(capturedBody.input.image_input, ["https://cdn.denotenman.com/product.webp"]);
    assert.equal(capturedBody.input.size, "2K");
    assert.equal(capturedBody.input.sequential_image_generation, "disabled");
    assert.equal(capturedBody.input.disable_safety_checker, false);
  } finally {
    if (previous === undefined) delete process.env.VMODEL_API_KEY;
    else process.env.VMODEL_API_KEY = previous;
  }
});

test("VModel task polling and output download stay authenticated and host restricted", async () => {
  const previous = process.env.VMODEL_API_KEY;
  process.env.VMODEL_API_KEY = "test-secret";
  try {
    const task = await getVModelTask("task_123", async (_input, init) => {
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-secret");
      return Response.json({ code: 200, result: { task_id: "task_123", status: "succeeded", output: ["https://data.vmodel.ai/result.png"], error: null } });
    });
    assert.equal(task.status, "succeeded");
    assert.deepEqual(task.outputUrls, ["https://data.vmodel.ai/result.png"]);

    const image = await downloadVModelImage(task.outputUrls[0], async (input, init) => {
      assert.equal(String(input), "https://data.vmodel.ai/result.png");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-secret");
      assert.equal(init?.redirect, "error");
      return new Response(await png(32, 20), { headers: { "content-type": "image/png" } });
    });
    assert.equal(image.contentType, "image/webp");
    assert.equal(image.width, 32);
    assert.equal(image.height, 20);

    let called = false;
    await assert.rejects(
      () => downloadVModelImage("https://example.com/result.png", async () => { called = true; return new Response(); }),
      (error: unknown) => error instanceof VModelError && error.code === "INVALID_OUTPUT_URL",
    );
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.VMODEL_API_KEY;
    else process.env.VMODEL_API_KEY = previous;
  }
});
