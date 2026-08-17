import "server-only";
import { z } from "zod";

const mailchimpEnvironmentSchema = z.object({
  MAILCHIMP_API_KEY: z.string().trim().min(1, "MAILCHIMP_API_KEY is required"),
  MAILCHIMP_SERVER_PREFIX: z
    .string()
    .trim()
    .regex(/^[a-z]{2}\d+$/i, "MAILCHIMP_SERVER_PREFIX must look like us21"),
  MAILCHIMP_AUDIENCE_ID: z.string().trim().min(1, "MAILCHIMP_AUDIENCE_ID is required"),
  MAILCHIMP_WEBHOOK_SECRET: z
    .string()
    .trim()
    .min(24, "MAILCHIMP_WEBHOOK_SECRET must contain at least 24 characters"),
});

export type MailchimpEnvironment = z.infer<typeof mailchimpEnvironmentSchema>;

let cachedMailchimpEnvironment: MailchimpEnvironment | undefined;

export function getMailchimpEnvironment(): MailchimpEnvironment {
  if (cachedMailchimpEnvironment) return cachedMailchimpEnvironment;

  const parsed = mailchimpEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid Mailchimp environment: ${missing}`);
  }

  cachedMailchimpEnvironment = parsed.data;
  return cachedMailchimpEnvironment;
}
