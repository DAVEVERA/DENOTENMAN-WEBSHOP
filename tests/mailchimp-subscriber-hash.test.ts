import assert from "node:assert/strict";
import { normalizeSubscriberEmail, subscriberHash } from "../lib/mailchimp/subscriberHash";

assert.equal(normalizeSubscriberEmail("  Daan@Example.COM  "), "daan@example.com");
assert.equal(subscriberHash("test@example.com"), "55502f40dc8b7c769880b10874abc9d0");
assert.equal(subscriberHash(" TEST@example.com "), subscriberHash("test@example.com"));

console.log("Mailchimp subscriber hash tests passed");
