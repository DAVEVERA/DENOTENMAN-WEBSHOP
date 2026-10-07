import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { copywriterBadge, geminiImageBadge, photoRoomBadge, vModelBadge } from "../lib/design-studio/provider-badges";

const hubSource = readFileSync(join(process.cwd(), "app/admin/(dashboard)/design-studio/page.tsx"), "utf8");

test("PhotoRoom hub badge reflects live account availability", () => {
  assert.deepEqual(
    photoRoomBadge({ provider: "photoroom", dailyLimit: 25, availability: { status: "ready", availableCredits: 40, requiredCredits: 5 } }),
    { className: "bg-green-100 text-green-800", label: "Klaar", detail: "40 credits" },
  );
  assert.equal(
    photoRoomBadge({ provider: "photoroom", dailyLimit: 25, availability: { status: "insufficient_credits", availableCredits: 0, requiredCredits: 5 } }).label,
    "Tegoed op",
  );
  assert.equal(
    photoRoomBadge({ provider: "photoroom", dailyLimit: 25, availability: { status: "insufficient_credits", availableCredits: 2, requiredCredits: 5 } }).label,
    "Tegoed te laag",
  );
  assert.equal(
    photoRoomBadge({ provider: "photoroom", dailyLimit: 25, availability: { status: "not_configured", availableCredits: null, requiredCredits: null } }).label,
    "Niet geconfigureerd",
  );
  assert.equal(
    photoRoomBadge({ provider: "photoroom", dailyLimit: 25, availability: { status: "invalid_configuration", availableCredits: null, requiredCredits: null } }).label,
    "Sleutel geweigerd",
  );
  assert.equal(
    photoRoomBadge({ provider: "photoroom", dailyLimit: 25, availability: { status: "unavailable", availableCredits: null, requiredCredits: null } }).label,
    "Niet bereikbaar",
  );
});

test("VModel hub badge shows configuration and remaining daily attempts", () => {
  assert.equal(vModelBadge({ provider: "vmodel", configured: false, availability: { status: "not_configured", availableCredits: null }, attemptsUsed: 0, dailyLimit: 25 }).label, "Niet geconfigureerd");
  assert.equal(vModelBadge({ provider: "vmodel", configured: true, availability: { status: "invalid_configuration", availableCredits: null }, attemptsUsed: 0, dailyLimit: 25 }).label, "Token geweigerd");
  assert.equal(vModelBadge({ provider: "vmodel", configured: true, availability: { status: "insufficient_credits", availableCredits: 0 }, attemptsUsed: 0, dailyLimit: 25 }).label, "Tegoed op");
  const ready = vModelBadge({ provider: "vmodel", configured: true, availability: { status: "ready", availableCredits: 48.5 }, attemptsUsed: 4, dailyLimit: 25 });
  assert.equal(ready.label, "Klaar");
  assert.equal(ready.detail, "48.5 credits · 21 van 25 vandaag");
  const exhausted = vModelBadge({ provider: "vmodel", configured: true, availability: { status: "ready", availableCredits: 48.5 }, attemptsUsed: 25, dailyLimit: 25 });
  assert.equal(exhausted.label, "Limiet bereikt");
  assert.equal(exhausted.detail, "25 van 25 vandaag");
});

test("Gemini Image hub badge shows verified access and remaining daily attempts", () => {
  assert.equal(geminiImageBadge({ provider: "gemini", configured: false, availability: { status: "not_configured", availableModels: [] }, attemptsUsed: 0, dailyLimit: 25 }).label, "Niet geconfigureerd");
  assert.equal(geminiImageBadge({ provider: "gemini", configured: true, availability: { status: "invalid_configuration", availableModels: [] }, attemptsUsed: 0, dailyLimit: 25 }).label, "Sleutel geweigerd");
  const ready = geminiImageBadge({ provider: "gemini", configured: true, availability: { status: "ready", availableModels: ["gemini-3.1-flash-image"] }, attemptsUsed: 3, dailyLimit: 25 });
  assert.deepEqual(ready, { className: "bg-green-100 text-green-800", label: "Klaar", detail: "22 van 25 vandaag" });
});

test("CopyWriter hub badge reflects Gemini configuration", () => {
  assert.equal(copywriterBadge({ provider: "copywriter", configured: true }).label, "Klaar");
  assert.equal(copywriterBadge({ provider: "copywriter", configured: false }).label, "Niet geconfigureerd");
});

test("Design Studio hub reads live provider status and links to the media library", () => {
  assert.match(hubSource, /getDesignStudioProviderStatuses/);
  assert.match(hubSource, /geminiImageBadge\(statuses\.geminiImage\)/);
  assert.match(hubSource, /vModelBadge\(statuses\.vmodel\)/);
  assert.match(hubSource, /copywriterBadge\(statuses\.copywriter\)/);
  assert.match(hubSource, /href="\/admin\/design-studio\/mediabibliotheek"/);
  assert.doesNotMatch(hubSource, /Beschikbaar/);
});
