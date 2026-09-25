import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_TAG_NAME,
  BusinessSegmentUnavailableError,
  buildAudienceSegmentOpts,
  findBusinessSegment,
  syncBusinessNewsletterTagsCore,
  audienceFromRecipients,
} from "../lib/mailchimp/business-segment-logic";

test("buildAudienceSegmentOpts leaves recipients unsegmented for everyone", () => {
  assert.equal(buildAudienceSegmentOpts("all", 42), undefined);
  assert.equal(buildAudienceSegmentOpts("all", null), undefined);
});

test("buildAudienceSegmentOpts targets the business tag for zakelijk", () => {
  assert.deepEqual(buildAudienceSegmentOpts("zakelijk", 48433), {
    match: "any",
    conditions: [
      { condition_type: "StaticSegment", field: "static_segment", op: "static_is", value: 48433 },
    ],
  });
});

test("buildAudienceSegmentOpts excludes the business tag for particulier", () => {
  assert.deepEqual(buildAudienceSegmentOpts("particulier", 48433), {
    match: "any",
    conditions: [
      { condition_type: "StaticSegment", field: "static_segment", op: "static_not", value: 48433 },
    ],
  });
});

test("buildAudienceSegmentOpts refuses to segment before the tag exists", () => {
  assert.throws(() => buildAudienceSegmentOpts("zakelijk", null), BusinessSegmentUnavailableError);
  assert.throws(() => buildAudienceSegmentOpts("particulier", null), BusinessSegmentUnavailableError);
});

test("findBusinessSegment reads the static segment id and member count by name", () => {
  const response = {
    segments: [
      { id: 111, name: "Nieuwjaarsklanten", type: "static", member_count: 5 },
      { id: 222, name: BUSINESS_TAG_NAME, type: "static", member_count: 17 },
    ],
  };
  assert.deepEqual(findBusinessSegment(response), { segmentId: 222, memberCount: 17 });
});

test("findBusinessSegment reports unavailable when the tag has never been applied", () => {
  assert.deepEqual(findBusinessSegment({ segments: [] }), { segmentId: null, memberCount: 0 });
  assert.deepEqual(findBusinessSegment(null), { segmentId: null, memberCount: 0 });
});

test("syncBusinessNewsletterTagsCore tags every business email and counts failures separately", async () => {
  const tagged: string[] = [];
  const result = await syncBusinessNewsletterTagsCore({
    listBusinessEmails: async () => ["zaak@example.com", "onbekend@example.com"],
    tagMember: async (email) => {
      if (email === "onbekend@example.com") throw { status: 404 };
      tagged.push(email);
    },
  });

  assert.deepEqual(tagged, ["zaak@example.com"]);
  assert.deepEqual(result, { total: 2, tagged: 1, skipped: 1 });
});

test("audience classification requires the exact business tag and no additional filters", () => {
  const recipients = (opts: unknown) => ({ segment_opts: opts });
  assert.equal(audienceFromRecipients({}, 42), "all");
  assert.equal(audienceFromRecipients(recipients(buildAudienceSegmentOpts("zakelijk", 42)), 42), "zakelijk");
  assert.equal(audienceFromRecipients(recipients(buildAudienceSegmentOpts("particulier", 42)), 42), "particulier");
  assert.equal(audienceFromRecipients(recipients(buildAudienceSegmentOpts("zakelijk", 43)), 42), "custom");
  assert.equal(audienceFromRecipients(recipients(buildAudienceSegmentOpts("zakelijk", 42)), null), "custom");
  assert.equal(audienceFromRecipients(recipients({ saved_segment_id: 42 }), 42), "custom");
  assert.equal(audienceFromRecipients(recipients({ match: "all", conditions: [
    { condition_type: "StaticSegment", field: "static_segment", op: "static_is", value: 42 },
    { condition_type: "EmailAddress", op: "contains", value: "example" },
  ] }), 42), "custom");
  assert.equal(audienceFromRecipients(recipients({ conditions: [{ op: "static_is", value: 42 }] }), 42), "custom");
});

test("tag lookup ignores saved segments with the business name", () => {
  assert.deepEqual(findBusinessSegment({ segments: [{ id: 42, name: BUSINESS_TAG_NAME, type: "saved" }] }), { segmentId: null, memberCount: 0 });
});

test("sync propagates provider and network failures", async () => {
  for (const error of [new Error("network"), { status: 401 }, { status: 403 }, { status: 429 }, { response: { status: 500 } }]) {
    await assert.rejects(syncBusinessNewsletterTagsCore({
      listBusinessEmails: async () => ["test@example.com"],
      tagMember: async () => { throw error; },
    }), (actual) => actual === error);
  }
});

test("syncBusinessNewsletterTagsCore handles an empty business account list", async () => {
  const result = await syncBusinessNewsletterTagsCore({
    listBusinessEmails: async () => [],
    tagMember: async () => {
      throw new Error("should not be called");
    },
  });

  assert.deepEqual(result, { total: 0, tagged: 0, skipped: 0 });
});
