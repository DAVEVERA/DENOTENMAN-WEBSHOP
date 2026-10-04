import { z } from "zod";
import { newsletterTargetingSchema, targetingProblem } from "@/lib/mailchimp/targeting";
import { newsletterDocumentSchema } from "@/lib/newsletter/document";

/** "segment" sends to a saved Mailchimp segment or a tag selection; "custom" keeps what Mailchimp has. */
export const newsletterAudienceSchema = z.enum(["all", "zakelijk", "particulier", "segment", "custom"]);

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
    /** Segment or tags, used when audience is "segment". */
    targeting: newsletterTargetingSchema.optional(),
    /** Block editor layout; when present the email is rendered from it on the server. */
    document: newsletterDocumentSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.audience !== "segment") return;
    const problem = targetingProblem(input.targeting);
    if (problem) context.addIssue({ code: z.ZodIssueCode.custom, path: ["targeting"], message: problem });
  });

/** One address, or up to ten at once for a review round. */
export const newsletterTestSchema = z
  .object({
    email: z.string().trim().email().optional(),
    emails: z.array(z.string().trim().email()).min(1).max(10).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.email || input.emails?.length), { message: "Vul ten minste één testadres in." })
  .transform((input) => ({ emails: [...new Set([...(input.emails ?? []), ...(input.email ? [input.email] : [])])].slice(0, 10) }));

export const newsletterSendSchema = z.object({ confirm: z.literal(true) }).strict();

export const newsletterScheduleSchema = z
  .object({ scheduleTime: z.string().datetime({ offset: true }), confirm: z.literal(true) })
  .strict()
  .refine((input) => new Date(input.scheduleTime).getTime() > Date.now(), {
    path: ["scheduleTime"],
    message: "Verzendmoment moet in de toekomst liggen.",
  });
