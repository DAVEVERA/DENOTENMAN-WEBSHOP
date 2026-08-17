import assert from "node:assert/strict";
import { isMailchimpRateLimit, normalizeMailchimpError } from "../lib/mailchimp/errors";

const problem = normalizeMailchimpError({
  status: 400,
  response: {
    body: {
      status: 400,
      title: "Invalid Resource",
      detail: "The resource submitted could not be validated.",
      errors: [{ field: "settings.subject_line", message: "This value is required." }],
    },
  },
});

assert.deepEqual(problem, {
  status: 400,
  title: "Invalid Resource",
  detail: "The resource submitted could not be validated.",
  field: "settings.subject_line",
  fieldErrors: [
    { field: "settings.subject_line", message: "This value is required." },
  ],
});
assert.equal(isMailchimpRateLimit({ status: 429 }), true);
assert.equal(isMailchimpRateLimit({ status: 400 }), false);

console.log("Mailchimp error normalization tests passed");
