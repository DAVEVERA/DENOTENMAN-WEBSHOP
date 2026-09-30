import assert from "node:assert/strict";
import test from "node:test";

import { captionFor, platformProblems, tiktokChunkPlan, youtubeTitleFor } from "../lib/social/platforms";

const image = { contentType: "image/jpeg" };
const png = { contentType: "image/png" };
const video = { contentType: "video/mp4" };

test("each platform accepts only what it can publish", () => {
  assert.deepEqual(platformProblems("FACEBOOK", { caption: "Nieuwe oogst", media: [] }), [], "Facebook takes text only");
  assert.match(platformProblems("FACEBOOK", { caption: "", media: [] }).join(), /tekst, een link of media/u);
  assert.match(platformProblems("INSTAGRAM", { caption: "Mooi", media: [] }).join(), /minimaal één foto/u);
  assert.deepEqual(platformProblems("INSTAGRAM", { caption: "Mooi", media: [image, png] }), [], "a carousel of photos");
  assert.match(platformProblems("INSTAGRAM", { caption: "Mooi", media: [image, video] }).join(), /niet in één bericht combineren/u);
  assert.match(platformProblems("TIKTOK", { caption: "Kijk", media: [image] }).join(), /precies één video/u);
  assert.deepEqual(platformProblems("TIKTOK", { caption: "Kijk", media: [video] }), []);
  assert.match(platformProblems("YOUTUBE", { caption: "", media: [video] }).join(), /titel/u);
  assert.deepEqual(platformProblems("YOUTUBE", { caption: "Zo branden wij noten\nMeer tekst", media: [video] }), []);
  assert.match(platformProblems("YOUTUBE", { caption: "Noten <3", media: [video], youtubeTitle: "Branden" }).join(), /< of >/u);
});

test("caption limits and hashtag limits are enforced per platform", () => {
  assert.match(platformProblems("INSTAGRAM", { caption: "a".repeat(2_201), media: [image] }).join(), /te lang voor Instagram/u);
  const hashtags = Array.from({ length: 31 }, (_, index) => `#noten${index}`).join(" ");
  assert.match(platformProblems("INSTAGRAM", { caption: hashtags, media: [image] }).join(), /30 hashtags/u);
  assert.deepEqual(platformProblems("FACEBOOK", { caption: "a".repeat(5_000), media: [] }), []);
});

test("a channel-specific caption wins over the general one; the YouTube title falls back to the first line", () => {
  const post = { caption: "Algemeen\nTweede regel", platformCaptions: { INSTAGRAM: "Alleen Instagram #noten" }, youtubeTitle: null };
  assert.equal(captionFor(post, "INSTAGRAM"), "Alleen Instagram #noten");
  assert.equal(captionFor(post, "FACEBOOK"), "Algemeen\nTweede regel");
  assert.equal(youtubeTitleFor(post), "Algemeen");
  assert.equal(youtubeTitleFor({ ...post, youtubeTitle: "Eigen titel" }), "Eigen titel");
});

test("TikTok uploads small videos in one chunk and large ones in 10 MB chunks", () => {
  const MB = 1024 * 1024;
  assert.deepEqual(tiktokChunkPlan(3 * MB), { chunkSize: 3 * MB, count: 1 });
  assert.deepEqual(tiktokChunkPlan(64 * MB), { chunkSize: 64 * MB, count: 1 });
  const large = tiktokChunkPlan(105 * MB + 123);
  assert.equal(large.chunkSize, 10 * MB);
  assert.equal(large.count, 10, "the last chunk takes the remainder");
});
