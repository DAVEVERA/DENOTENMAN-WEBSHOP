import assert from "node:assert/strict";
import test from "node:test";

import { describeDevice, iphoneModelFromScreen, networkOf } from "../lib/developer-portal/device";

const iphoneUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1";

test("an iPhone gets its model family from the screen and its iOS from Safari", () => {
  assert.deepEqual(describeDevice(iphoneUa, { width: 393, height: 852, pixelRatio: 3 }), { device: "iPhone", model: "iPhone 14 Pro/15/15 Pro of 16", os: "iOS 26.6", browser: "Safari 26.6.1" });
  assert.equal(iphoneModelFromScreen({ width: 956, height: 440, pixelRatio: 3 }), "iPhone 16 Pro Max of 17 Pro Max", "landscape works too");
  assert.equal(iphoneModelFromScreen({ width: 400, height: 900, pixelRatio: 3 }), "iPhone met scherm 400×900 (@3x)");
  assert.equal(describeDevice(iphoneUa).model, null, "without a screen the model is unknown");
  assert.equal(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1").os, "iOS 17.5");
});

test("Android uses Chrome's model hint, Windows 11 is told apart by the platform version", () => {
  const android = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
  assert.deepEqual(describeDevice(android, null, { model: "SM-S921B", platformVersion: "15.0.0" }), { device: "Android-telefoon", model: "SM-S921B", os: "Android 15", browser: "Chrome 141" });
  assert.equal(describeDevice(android).model, null, "the reduced user agent hides the model");
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
  assert.deepEqual(describeDevice(windows, null, { platformVersion: "15.0.0" }), { device: "Windows-pc", model: null, os: "Windows 11", browser: "Edge 141" });
});

test("the network is stored without the last part of the address", () => {
  assert.equal(networkOf("84.29.10.20, 10.0.0.1"), "84.29.10.0/24");
  assert.equal(networkOf("2a02:a420:243f:1:2:3:4:5"), "2a02:a420:243f::/48");
  assert.equal(networkOf(null), null);
  assert.equal(networkOf("not an address"), null);
});
