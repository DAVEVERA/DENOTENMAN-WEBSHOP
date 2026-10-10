import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCenteredSquareCrop,
  calculateFullFrameSquareCrop,
} from "../lib/product-image-migration/crop";
import {
  cropStrategyGrades,
  IMAGE_PROCESSING_VERSION,
} from "../lib/product-image-migration/config";

test("a square source keeps its whole frame", () => {
  const plan = calculateFullFrameSquareCrop(1200, 1200);

  assert.ok(plan.ok);
  assert.deepEqual(plan.crop, { left: 0, top: 0, size: 1200 });
});

test("a landscape source is cropped to the centred square", () => {
  const plan = calculateFullFrameSquareCrop(1600, 1000);

  assert.ok(plan.ok);
  assert.deepEqual(plan.crop, { left: 300, top: 0, size: 1000 });
});

test("a portrait source is cropped to the centred square", () => {
  const plan = calculateFullFrameSquareCrop(900, 1500);

  assert.ok(plan.ok);
  assert.deepEqual(plan.crop, { left: 0, top: 300, size: 900 });
});

test("the fallback never leaves the source bounds", () => {
  for (const [width, height] of [[1200, 1200], [1600, 1000], [900, 1500], [1, 4000]]) {
    const plan = calculateFullFrameSquareCrop(width, height);
    assert.ok(plan.ok, `${width}x${height} should produce a crop`);
    assert.ok(plan.crop.left >= 0 && plan.crop.top >= 0);
    assert.ok(plan.crop.left + plan.crop.size <= width);
    assert.ok(plan.crop.top + plan.crop.size <= height);
  }
});

test("an unusable source is still refused rather than silently cropped", () => {
  for (const [width, height] of [[0, 100], [100, 0], [-5, 100], [10.5, 10]]) {
    const plan = calculateFullFrameSquareCrop(width, height);
    assert.equal(plan.ok, false, `${width}x${height} should be refused`);
  }
});

test("the fallback covers the cases the circle crop refuses", () => {
  // A circle too close to the edge leaves no room for a margin, which is the
  // main reason a confident detection still cannot be cropped.
  const circle = calculateCenteredSquareCrop(1200, 1200, { centerX: 60, centerY: 600, radius: 400 }, 0.12);
  assert.equal(circle.ok, false);

  const fallback = calculateFullFrameSquareCrop(1200, 1200);
  assert.ok(fallback.ok);
});

test("every crop strategy maps to a grade, and the version names the guarantee", () => {
  assert.equal(cropStrategyGrades["circle-center"], "best");
  assert.equal(cropStrategyGrades["centered-square"], "good");
  assert.deepEqual(Object.values(cropStrategyGrades).sort(), ["best", "good"]);
  assert.equal(IMAGE_PROCESSING_VERSION, "card-ready-v2");
});
