import { z } from "zod";
import { newsletterDocumentSchema } from "@/lib/newsletter/document";

export const newsletterAudienceSchema = z.enum(["all", "zakelijk", "particulier", "custom"]);

export type NewsletterAudience = z.infer<typeof newsletterAudienceSchema>;

export const newsletterDraftSchema = z
  .object({
    subject: z.string().trim().min(1).max(150),
    previewText: z.string().trim().max(255),
    title: z.string().trim().min(1).max(150),
    fromName: z.string().trim().min(1).max(100),
    replyTo: z.string().trim().email(),
    contentHtml: z.string().trim().min(1).max(100_000),
    audience: newsletterAudienceSchema.default("custom"),
    /** Block editor layout; when present the email is rendered from it on the server. */
    document: newsletterDocumentSchema.optional(),
  })
  .strict();

export const newsletterTestSchema = z
  .object({ email: z.string().trim().email() })
  .strict();

export const newsletterSendSchema = z.object({ confirm: z.literal(true) }).strict();

export const newsletterScheduleSchema = z
  .object({ scheduleTime: z.string().datetime({ offset: true }), confirm: z.literal(true) })
  .strict()
  .refine((input) => new Date(input.scheduleTime).getTime() > Date.now(), {
    path: ["scheduleTime"],
    message: "Verzendmoment moet in de toekomst liggen.",
  });
