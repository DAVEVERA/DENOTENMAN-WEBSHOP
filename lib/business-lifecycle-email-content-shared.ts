import { z } from "zod";

export type BusinessLifecycleEmailKindValue = "INVITATION" | "INVOICE";

export type BusinessLifecycleEmailContentValue = {
  subject: string;
  heading: string;
  bodyText: string;
  buttonLabel: string;
};

export const BUSINESS_LIFECYCLE_EMAIL_KINDS: BusinessLifecycleEmailKindValue[] = ["INVITATION", "INVOICE"];

export const BUSINESS_LIFECYCLE_EMAIL_DEFAULTS: Record<BusinessLifecycleEmailKindValue, BusinessLifecycleEmailContentValue> = {
  INVITATION: {
    subject: "Uitnodiging voor de zakelijke omgeving van De Notenman",
    heading: "Welkom bij De Notenman zakelijk, {contactName}",
    bodyText:
      "Fedor heeft een zakelijke omgeving voor {companyName} klaargezet. Hier vind je straks je bestellijsten, facturen en betaalstatus.",
    buttonLabel: "Activeer mijn zakelijke omgeving",
  },
  INVOICE: {
    subject: "Factuur {invoiceNumber} - De Notenman",
    heading: "Factuur {invoiceNumber}",
    bodyText: "Beste {recipientName}, hierbij de factuur voor de betaalde bestelling van {companyName}.",
    buttonLabel: "Factuur downloaden (PDF)",
  },
};

export const businessLifecycleEmailPatchSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    heading: z.string().trim().min(1).max(200),
    bodyText: z.string().trim().min(1).max(2000),
    buttonLabel: z.string().trim().min(1).max(60).nullable().optional(),
  })
  .strict();

export function substituteBusinessLifecycleTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, token: string) => {
    return Object.prototype.hasOwnProperty.call(tokens, token) ? tokens[token] : match;
  });
}
