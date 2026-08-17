import { createHash } from "node:crypto";

export function normalizeSubscriberEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function subscriberHash(email: string): string {
  return createHash("md5").update(normalizeSubscriberEmail(email), "utf8").digest("hex");
}
