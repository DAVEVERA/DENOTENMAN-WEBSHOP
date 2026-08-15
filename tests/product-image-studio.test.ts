import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  ConfigurationMissingError,
  ProductImageStudioError,
  StudioConflictError,
  StudioValidationError,
  buildStudioVersionKey,
  createOpenAIImageGateway,
  consumeStudioRateLimit,
  parseStudioRequest,
  planImageDeletion,
  planCanonicalImageOrder,
  prepareAIStudioEdit,
  runDeterministicStudioOperation,
  toStudioErrorResponse,
  validateStudioImage,
} from "../lib/product-image-studio";

test("studio outputs use a new traversal-safe version key", () => {
  const key = buildStudioVersionKey("Amandelen Naturel", "remove_background", "image_123");
  assert.match(key, /^products\/amandelen-naturel\/versions\/image_123\/remove_background-[0-9a-f-]+\.png$/);
  assert.equal(key.includes(".."), false);
  assert.throws(
    () => buildStudioVersionKey("../../", "crop", "image_123"),
    (error: unknown) => error instanceof StudioValidationError && error.code === "VALIDATION_ERROR"
  );
});

test("AI operations fail with CONFIGURATION_MISSING before making an HTTP request", async () => {
  let called = false;
  const gateway = createOpenAIImageGateway({
    apiKey: undefined,
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });

  await assert.rejects(
    gateway.generate({ prompt: "A studio photograph of almonds", width: 1024, height: 1024, quality: "medium" }),
    (error: unknown) => error instanceof ConfigurationMissingError && error.code === "CONFIGURATION_MISSING"
  );
  assert.equal(called, false);
});

test("generation sends a bounded gpt-image-2 request without unsupported transparency", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const gateway = createOpenAIImageGateway({
    apiKey: "test-only-key",
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("generated").toString("base64") }] }), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "req_test" },
      });
    },
  });

  const result = await gateway.generate({
    prompt: "A clean product photograph of roasted almonds",
    width: 1024,
    height: 1024,
    quality: "high",
  });

  assert.equal(request?.url, "https://api.openai.com/v1/images/generations");
  const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>;
  assert.deepEqual(body, {
    model: "gpt-image-2",
    prompt: "A clean product photograph of roasted almonds",
    size: "1024x1024",
    quality: "high",
    output_format: "png",
    background: "opaque",
    n: 1,
  });
  assert.equal(result.requestId, "req_test");
  assert.equal(result.bytes.toString(), "generated");
});

test("editing uses multipart gpt-image-2 input and omits input_fidelity", async () => {
  let form: FormData | undefined;
  const gateway = createOpenAIImageGateway({
    apiKey: "test-only-key",
    fetchImpl: async (_url, init) => {
      form = init?.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("edited").toString("base64") }] }), { status: 200 });
    },
  });

  await gateway.edit({
    prompt: "Fill the selected area with the same wooden surface",
    image: Buffer.from("source"),
    mask: Buffer.from("mask"),
    width: 1024,
    height: 1024,
    quality: "medium",
  });

  assert.equal(form?.get("model"), "gpt-image-2");
  assert.equal(form?.get("size"), "1024x1024");
  assert.equal(form?.get("background"), "opaque");
  assert.equal(form?.has("input_fidelity"), false);
  assert.ok(form?.get("image") instanceof File);
  assert.ok(form?.get("mask") instanceof File);
});

test("image generation reports exhausted credits separately from a temporary rate limit", async () => {
  const gateway = createOpenAIImageGateway({
    apiKey: "test-only-key",
    fetchImpl: async () => new Response(
      JSON.stringify({ error: { code: "credit_balance_exhausted", message: "No credits" } }),
      { status: 429, headers: { "content-type": "application/json" } }
    ),
  });

  await assert.rejects(
    gateway.generate({ prompt: "A studio photograph of almonds", width: 1024, height: 1024, quality: "low" }),
    (error: unknown) => error instanceof ProductImageStudioError
      && error.code === "CREDITS_EXHAUSTED"
      && error.status === 402
  );
});

test("studio validation enforces GPT Image 2 dimensions and operation limits", () => {
  assert.throws(
    () => parseStudioRequest({ operation: "generate", prompt: "test", width: 1000, height: 1024, quality: "medium" }),
    (error: unknown) => error instanceof StudioValidationError && error.code === "INVALID_DIMENSIONS"
  );
  assert.throws(
    () => parseStudioRequest({ operation: "text_label", sourceImageId: "img_1", text: "x".repeat(81), x: 0, y: 0, fontSize: 32, color: "#111111" }),
    (error: unknown) => error instanceof StudioValidationError && error.code === "VALIDATION_ERROR"
  );
  assert.throws(
    () => parseStudioRequest({ operation: "resize", sourceImageId: "img_1", width: 512, height: 512, fit: "contain", unsafe: true }),
    (error: unknown) => error instanceof StudioValidationError && error.code === "VALIDATION_ERROR"
  );
});

test("studio source validation rejects malformed and decompression-bomb inputs", async () => {
  await assert.rejects(
    validateStudioImage(Buffer.from("not-an-image")),
    (error: unknown) => error instanceof StudioValidationError && error.code === "VALIDATION_ERROR"
  );

  const tooManyPixels = await sharp({
    create: { width: 4_001, height: 4_000, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  await assert.rejects(
    validateStudioImage(tooManyPixels),
    (error: unknown) => error instanceof StudioValidationError && error.code === "VALIDATION_ERROR"
  );
  await assert.rejects(
    validateStudioImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32"/></svg>')),
    (error: unknown) => error instanceof StudioValidationError && error.code === "VALIDATION_ERROR"
  );
});

test("reorder contract requires the exact current image set and derives one primary", () => {
  const current = [
    { id: "a", sortOrder: 0, isPrimary: true },
    { id: "b", sortOrder: 1, isPrimary: false },
    { id: "c", sortOrder: 2, isPrimary: false },
  ];

  const updates = planCanonicalImageOrder({
    current,
    expectedImageIds: ["a", "b", "c"],
    orderedImageIds: ["c", "a", "b"],
    primaryImageId: "a",
  });

  assert.deepEqual(updates, [
    { id: "c", sortOrder: 0, isPrimary: false },
    { id: "a", sortOrder: 1, isPrimary: true },
    { id: "b", sortOrder: 2, isPrimary: false },
  ]);
});

test("reorder contract rejects stale state and duplicate IDs", () => {
  const current = [
    { id: "a", sortOrder: 0, isPrimary: true },
    { id: "b", sortOrder: 1, isPrimary: false },
  ];

  assert.throws(
    () => planCanonicalImageOrder({ current, expectedImageIds: ["b", "a"], orderedImageIds: ["a", "b"] }),
    (error: unknown) => error instanceof StudioConflictError && error.code === "IMAGE_ORDER_CONFLICT"
  );
  assert.throws(
    () => planCanonicalImageOrder({ current, expectedImageIds: ["a", "b"], orderedImageIds: ["a", "a"] }),
    (error: unknown) => error instanceof StudioValidationError
  );
});

test("delete planning refuses the final image and canonically promotes a replacement", () => {
  assert.throws(
    () => planImageDeletion([{ id: "only", sortOrder: 7, isPrimary: true }], "only"),
    (error: unknown) => error instanceof ProductImageStudioError && error.code === "LAST_IMAGE"
  );

  assert.deepEqual(
    planImageDeletion(
      [
        { id: "primary", sortOrder: 4, isPrimary: true },
        { id: "next", sortOrder: 9, isPrimary: false },
        { id: "last", sortOrder: 12, isPrimary: false },
      ],
      "primary"
    ),
    [
      { id: "next", sortOrder: 0, isPrimary: true },
      { id: "last", sortOrder: 1, isPrimary: false },
    ]
  );
});

test("deterministic crop and resize produce exact requested dimensions", async () => {
  const source = await sharp({
    create: { width: 120, height: 80, channels: 4, background: { r: 200, g: 10, b: 10, alpha: 1 } },
  }).png().toBuffer();

  const cropped = await runDeterministicStudioOperation(
    { operation: "crop", sourceImageId: "img_1", x: 10, y: 5, width: 60, height: 40 },
    source
  );
  const resized = await runDeterministicStudioOperation(
    { operation: "resize", sourceImageId: "img_1", width: 48, height: 32, fit: "contain" },
    source
  );

  assert.deepEqual(await sharp(cropped.bytes).metadata().then(({ width, height }) => ({ width, height })), { width: 60, height: 40 });
  assert.deepEqual(await sharp(resized.bytes).metadata().then(({ width, height }) => ({ width, height })), { width: 48, height: 32 });
});

test("background removal only clears matching pixels connected to the border", async () => {
  const pixels = Buffer.alloc(5 * 5 * 4);
  for (let index = 0; index < 25; index += 1) {
    const offset = index * 4;
    pixels.set([255, 255, 255, 255], offset);
  }
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      const offset = (y * 5 + x) * 4;
      pixels.set([180, 20, 20, 255], offset);
    }
  }
  pixels.set([255, 255, 255, 255], (2 * 5 + 2) * 4);
  const source = await sharp(pixels, { raw: { width: 5, height: 5, channels: 4 } }).png().toBuffer();

  const result = await runDeterministicStudioOperation(
    { operation: "remove_background", sourceImageId: "img_1", tolerance: 12 },
    source
  );
  const { data } = await sharp(result.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.equal(data[3], 0, "border background becomes transparent");
  assert.equal(data[(1 * 5 + 1) * 4 + 3], 255, "foreground remains opaque");
  assert.equal(data[(2 * 5 + 2) * 4 + 3], 255, "enclosed matching color remains opaque");
});

test("extend creates a same-size PNG mask with only the new canvas area editable", async () => {
  const source = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 150, g: 40, b: 20, alpha: 1 } },
  }).png().toBuffer();
  const request = parseStudioRequest({
    operation: "extend",
    sourceImageId: "img_1",
    prompt: "Continue the same neutral studio background",
    width: 1024,
    height: 1024,
    quality: "medium",
    anchor: "center",
  });
  if (request.operation !== "extend") assert.fail("Expected an extend request");

  const prepared = await prepareAIStudioEdit(request, source);
  const image = await sharp(prepared.image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = await sharp(prepared.mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.deepEqual({ width: image.info.width, height: image.info.height }, { width: 1024, height: 1024 });
  assert.deepEqual({ width: mask.info.width, height: mask.info.height }, { width: 1024, height: 1024 });
  assert.equal(mask.data[3], 0, "new outer canvas is editable");
  assert.equal(mask.data[(512 * 1024 + 512) * 4 + 3], 255, "original image area is protected");
});

test("fill creates a rectangular editable mask while preserving the rest", async () => {
  const source = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 220, g: 220, b: 220, alpha: 1 } },
  }).png().toBuffer();
  const request = parseStudioRequest({
    operation: "fill",
    sourceImageId: "img_1",
    prompt: "Repair the empty area with the surrounding surface",
    x: 100,
    y: 120,
    width: 200,
    height: 160,
    quality: "medium",
  });
  if (request.operation !== "fill") assert.fail("Expected a fill request");

  const prepared = await prepareAIStudioEdit(request, source);
  const { data, info } = await sharp(prepared.mask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.equal(data[3], 255, "outside the fill rectangle is protected");
  assert.equal(data[(150 * info.width + 150) * 4 + 3], 0, "inside the fill rectangle is editable");
});

test("text labels and approved icons are rendered deterministically without OpenAI", async () => {
  const source = await sharp({
    create: { width: 320, height: 240, channels: 4, background: { r: 245, g: 245, b: 245, alpha: 1 } },
  }).png().toBuffer();

  const labelled = await runDeterministicStudioOperation(
    { operation: "text_label", sourceImageId: "img_1", text: "Nieuw & <veilig>", x: 12, y: 12, fontSize: 24, color: "#111111", backgroundColor: "#ffffff" },
    source
  );
  const icon = await runDeterministicStudioOperation(
    { operation: "icon", sourceImageId: "img_1", icon: "leaf", x: 20, y: 20, size: 48, color: "#008081" },
    source
  );

  assert.deepEqual(await sharp(labelled.bytes).metadata().then(({ width, height }) => ({ width, height })), { width: 320, height: 240 });
  assert.deepEqual(await sharp(icon.bytes).metadata().then(({ width, height }) => ({ width, height })), { width: 320, height: 240 });
  assert.notDeepEqual(labelled.bytes, source);
  assert.notDeepEqual(icon.bytes, source);
});

test("configuration errors map to a specific safe API response", () => {
  assert.deepEqual(toStudioErrorResponse(new ConfigurationMissingError()), {
    status: 503,
    body: {
      error: "CONFIGURATION_MISSING",
      message: "OPENAI_API_KEY is niet geconfigureerd voor AI-beeldbewerkingen.",
    },
  });
  assert.deepEqual(toStudioErrorResponse({ code: "P2034" }), {
    status: 409,
    body: {
      error: "IMAGE_ORDER_CONFLICT",
      message: "De afbeeldingen zijn gelijktijdig gewijzigd. Herlaad en probeer opnieuw.",
    },
  });
});

test("studio rate limiting rejects the sixth costly operation in one minute", () => {
  const state = new Map<string, { count: number; resetAt: number }>();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    consumeStudioRateLimit("admin:127.0.0.1", 1_000, state);
  }
  assert.throws(
    () => consumeStudioRateLimit("admin:127.0.0.1", 1_000, state),
    (error: unknown) => error instanceof ProductImageStudioError && error.code === "RATE_LIMITED"
  );
  assert.doesNotThrow(() => consumeStudioRateLimit("admin:127.0.0.1", 61_001, state));
});
