import assert from "node:assert/strict";
import test from "node:test";
import {
  GEO_AUDIT_BATCH_SIZE,
  GEO_AUDIT_INTERVAL_MS,
  geoAuditBatchFinished,
  geoAuditNextDueAt,
  geoAuditShouldStart,
} from "../lib/ai-vindbaarheid/schedule-policy";

test("automated audit repeats seven days after successful completion", () => {
  const finished = new Date("2026-11-22T18:00:00.000Z");
  const due = geoAuditNextDueAt(finished);
  assert.equal(due.getTime() - finished.getTime(), GEO_AUDIT_INTERVAL_MS);
});

test("new run starts only when due and there is no active unfinished run", () => {
  const now = new Date("2026-11-22T18:00:00.000Z");
  assert.equal(geoAuditShouldStart(now, now, null), true);
  assert.equal(geoAuditShouldStart(new Date(now.getTime() + 1), now, null), false);
  assert.equal(geoAuditShouldStart(new Date(now.getTime() - 1), now, "ongoing-run"), false);
});

test("exact full batch continues until the following empty batch", () => {
  assert.equal(geoAuditBatchFinished(GEO_AUDIT_BATCH_SIZE), false);
  assert.equal(geoAuditBatchFinished(0), true);
  assert.equal(geoAuditBatchFinished(GEO_AUDIT_BATCH_SIZE - 1), true);
});
