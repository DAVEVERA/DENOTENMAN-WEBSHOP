import assert from "node:assert/strict";
import test from "node:test";

import { newsletterDraftSchema, newsletterTestSchema } from "../lib/mailchimp/schemas";
import {
  buildTargetingSegmentOpts,
  EMPTY_TARGETING,
  mapAudienceSegments,
  NewsletterTargetingError,
  targetingFromRecipients,
  targetingProblem,
} from "../lib/mailchimp/targeting";

const draft = {
  subject: "Onderwerp",
  previewText: "",
  title: "Titel",
  fromName: "De Notenman",
  replyTo: "info@denotenman.com",
  contentHtml: "<p>Hallo</p>",
};

test("a saved segment is sent by its id", () => {
  assert.deepEqual(buildTargetingSegmentOpts({ ...EMPTY_TARGETING, savedSegmentId: 77 }), { saved_segment_id: 77 });
});

test("tags become static segment conditions with the chosen match rule", () => {
  assert.deepEqual(buildTargetingSegmentOpts({ savedSegmentId: null, includeTagIds: [1, 2], excludeTagIds: [3], match: "all" }), {
    match: "all",
    conditions: [
      { condition_type: "StaticSegment", field: "static_segment", op: "static_is", value: 1 },
      { condition_type: "StaticSegment", field: "static_segment", op: "static_is", value: 2 },
      { condition_type: "StaticSegment", field: "static_segment", op: "static_not", value: 3 },
    ],
  });
});

test("selections Mailchimp cannot express are refused before any request", () => {
  assert.match(targetingProblem(EMPTY_TARGETING) ?? "", /segment of ten minste één tag/u);
  assert.match(targetingProblem({ savedSegmentId: 5, includeTagIds: [1], excludeTagIds: [], match: "any" }) ?? "", /niet allebei/u);
  assert.match(targetingProblem({ savedSegmentId: null, includeTagIds: [1], excludeTagIds: [1], match: "all" }) ?? "", /tegelijk/u);
  // "any" with an exclusion would also mail everyone outside the excluded tag.
  assert.match(targetingProblem({ savedSegmentId: null, includeTagIds: [1], excludeTagIds: [2], match: "any" }) ?? "", /alle gekozen tags/u);
  assert.equal(targetingProblem({ savedSegmentId: null, includeTagIds: [], excludeTagIds: [2], match: "any" }), null, "only excluding one tag is fine");
  assert.throws(() => buildTargetingSegmentOpts(EMPTY_TARGETING), NewsletterTargetingError);
});

test("a campaign's recipients read back into the same selection", () => {
  const targeting = { savedSegmentId: null, includeTagIds: [4], excludeTagIds: [9], match: "all" as const };
  assert.deepEqual(targetingFromRecipients({ list_id: "x", segment_opts: buildTargetingSegmentOpts(targeting) }), targeting);
  assert.deepEqual(targetingFromRecipients({ segment_opts: { saved_segment_id: 12 } }), { ...EMPTY_TARGETING, savedSegmentId: 12 });
  assert.equal(targetingFromRecipients({}), null);
  assert.equal(targetingFromRecipients({ segment_opts: { match: "all", conditions: [{ condition_type: "EmailAddress", field: "EMAIL", op: "contains", value: "x" }] } }), null);
});

test("Mailchimp segments map to saved segments and tags, sorted by name", () => {
  const segments = mapAudienceSegments({ segments: [
    { id: 2, name: "Zakelijk", type: "static", member_count: 40 },
    { id: 3, name: "actieve kopers", type: "saved", member_count: 120 },
    { id: 4, name: "Oud", type: "fuzzy", member_count: 1 },
  ] });
  assert.deepEqual(segments.map((segment) => [segment.id, segment.type]), [[3, "saved"], [2, "static"]]);
});

test("the draft only accepts a segment audience with a sendable selection", () => {
  assert.equal(newsletterDraftSchema.safeParse({ ...draft, audience: "segment" }).success, false);
  assert.equal(newsletterDraftSchema.safeParse({ ...draft, audience: "segment", targeting: { ...EMPTY_TARGETING, includeTagIds: [8] } }).success, true);
  assert.equal(newsletterDraftSchema.safeParse({ ...draft, audience: "all", targeting: EMPTY_TARGETING }).success, true, "targeting is ignored for other audiences");
});

test("test mails go to one address or up to ten at once", () => {
  assert.deepEqual(newsletterTestSchema.parse({ email: "a@example.com" }), { emails: ["a@example.com"] });
  assert.deepEqual(newsletterTestSchema.parse({ emails: ["a@example.com", "b@example.com", "a@example.com"] }), { emails: ["a@example.com", "b@example.com"] });
  assert.equal(newsletterTestSchema.safeParse({ emails: [] }).success, false);
  assert.equal(newsletterTestSchema.safeParse({ emails: Array.from({ length: 11 }, (_, index) => `t${index}@example.com`) }).success, false);
  assert.equal(newsletterTestSchema.safeParse({}).success, false);
});
