import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  createNewsletterVideoThumbnail,
  isAllowedNewsletterThumbnailSource,
  VideoThumbnailError,
} from "../lib/newsletter/video-thumbnail";

const environment = {
  CDN_BASE_URL: "https://cdn.example.com/media",
  GCS_BUCKET: "test-bucket",
};

test("thumbnail source validation compares origins and paths instead of string prefixes", () => {
  assert.equal(isAllowedNewsletterThumbnailSource("https://cdn.example.com/media/poster.jpg", environment.CDN_BASE_URL), true);
  assert.equal(isAllowedNewsletterThumbnailSource("https://cdn.example.com/mediaology/poster.jpg", environment.CDN_BASE_URL), false);
  assert.equal(isAllowedNewsletterThumbnailSource("https://cdn.example.com.evil.test/media/poster.jpg", environment.CDN_BASE_URL), false);
  assert.equal(isAllowedNewsletterThumbnailSource("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"), true);
  assert.equal(isAllowedNewsletterThumbnailSource("https://img.youtube.com.evil.test/vi/dQw4w9WgXcQ/hqdefault.jpg"), false);
});

test("creates a 1200 by 675 jpeg and saves it in the newsletter namespace", async () => {
  const source = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#d4a017" } }).png().toBuffer();
  let saved = null as { key: string; bytes: Buffer; type: string } | null;
  const result = await createNewsletterVideoThumbnail(
    { videoUrl: "https://example.com/video.mp4", imageUrl: "https://cdn.example.com/media/poster.png" },
    environment,
    {
      fetchImpl: async () => new Response(source, { status: 200, headers: { "content-type": "image/png", "content-length": String(source.length) } }),
      save: async (key, bytes, type) => { saved = { key, bytes, type }; },
    },
  );
  assert.match(result.thumbnailUrl, /^https:\/\/cdn\.example\.com\/media\/newsletter\/video-thumbnails\/[0-9a-f-]+\.jpg$/u);
  assert.ok(saved);
  assert.match(saved.key, /^newsletter\/video-thumbnails\/[0-9a-f-]+\.jpg$/u);
  assert.equal(saved.type, "image/jpeg");
  const metadata = await sharp(saved.bytes).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 675);
  assert.equal(metadata.format, "jpeg");
});

test("requires a poster for uploaded or non-YouTube video links", async () => {
  await assert.rejects(
    createNewsletterVideoThumbnail({ videoUrl: "https://cdn.example.com/media/video.mp4" }, environment),
    (error: unknown) => error instanceof VideoThumbnailError && error.code === "IMAGE_REQUIRED" && error.status === 422,
  );
});

test("rejects an unexpected response type before image processing", async () => {
  await assert.rejects(
    createNewsletterVideoThumbnail(
      { videoUrl: "https://example.com/video.mp4", imageUrl: "https://cdn.example.com/media/poster.jpg" },
      environment,
      { fetchImpl: async () => new Response("not an image", { status: 200, headers: { "content-type": "text/html" } }) },
    ),
    (error: unknown) => error instanceof VideoThumbnailError && error.code === "IMAGE_TYPE" && error.status === 422,
  );
});

test("maps storage failures to a stable provider-safe error", async () => {
  const source = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000000" } }).jpeg().toBuffer();
  await assert.rejects(
    createNewsletterVideoThumbnail(
      { videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      environment,
      {
        fetchImpl: async () => new Response(source, { status: 200, headers: { "content-type": "image/jpeg" } }),
        save: async () => { throw new Error("bucket internals"); },
      },
    ),
    (error: unknown) => error instanceof VideoThumbnailError && error.code === "STORAGE_FAILED" && error.status === 502,
  );
});

test("each shape gives the matching size with the play button centred", async () => {
  const source = await sharp({ create: { width: 900, height: 1600, channels: 3, background: "#336699" } }).png().toBuffer();
  const sizes: Record<string, [number, number]> = { "1:1": [1200, 1200], "4:5": [1200, 1500], original: [1200, 2133] };
  for (const [aspect, [width, height]] of Object.entries(sizes)) {
    let bytes: Buffer | null = null;
    await createNewsletterVideoThumbnail(
      { videoUrl: "https://example.com/video.mp4", imageUrl: "https://cdn.example.com/media/poster.png", aspect: aspect as "1:1" | "4:5" | "original" },
      environment,
      {
        fetchImpl: async () => new Response(source, { status: 200, headers: { "content-type": "image/png" } }),
        save: async (_key, saved) => { bytes = saved; },
      },
    );
    assert.ok(bytes);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, width, aspect);
    assert.ok(Math.abs((metadata.height ?? 0) - height) <= 1, `${aspect} height ${metadata.height}`);
  }
});

test("a video passed as the still gets a clear message instead of a crash", async () => {
  await assert.rejects(
    createNewsletterVideoThumbnail(
      { videoUrl: "https://cdn.example.com/media/clip.mp4", imageUrl: "https://cdn.example.com/media/clip.mp4" },
      environment,
      { fetchImpl: async () => new Response("....", { status: 200, headers: { "content-type": "video/mp4" } }) },
    ),
    (error: unknown) => error instanceof VideoThumbnailError && error.code === "IMAGE_IS_VIDEO" && error.status === 422,
  );
});

test("bytes that are not an image map to a readable 422, never a 500", async () => {
  await assert.rejects(
    createNewsletterVideoThumbnail(
      { videoUrl: "https://example.com/video.mp4", imageUrl: "https://cdn.example.com/media/poster.jpg" },
      environment,
      { fetchImpl: async () => new Response("not really a jpeg", { status: 200, headers: { "content-type": "image/jpeg" } }) },
    ),
    (error: unknown) => error instanceof VideoThumbnailError && error.code === "IMAGE_UNREADABLE" && error.status === 422,
  );
});
