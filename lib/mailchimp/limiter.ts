import pLimit from "p-limit";
import { isMailchimpRateLimit } from "@/lib/mailchimp/errors";

const mailchimpLimit = pLimit(8);
const MAX_ATTEMPTS = 4;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runMailchimpRequest<T>(operation: () => Promise<T>): Promise<T> {
  return mailchimpLimit(async () => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isMailchimpRateLimit(error) || attempt === MAX_ATTEMPTS) throw error;
        await wait(300 * 2 ** (attempt - 1));
      }
    }

    throw new Error("Mailchimp retry loop ended unexpectedly");
  });
}
