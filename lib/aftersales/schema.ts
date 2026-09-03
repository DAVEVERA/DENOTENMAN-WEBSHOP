import { z } from "zod";
import { locales, type Locale } from "@/lib/i18n";

export const AFTERSALES_TRIGGERS = ["ORDER_PAID", "ORDER_FULFILLED"] as const;
export type AftersalesTriggerValue = (typeof AFTERSALES_TRIGGERS)[number];

export const AFTERSALES_TOKENS = [
  "first_name",
  "customer_name",
  "order_number",
  "order_total",
  "tracking_code",
  "order_url",
] as const;

export type AftersalesLocaleContent = {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  buttonLabel: string;
};

export type AftersalesContent = Record<Locale, AftersalesLocaleContent>;

export const AFTERSALES_LAYOUTS = ["CLASSIC", "IMAGE_TOP", "IMAGE_SIDE", "IMAGE_BOTTOM"] as const;
export type AftersalesLayout = (typeof AFTERSALES_LAYOUTS)[number];

export const AFTERSALES_FONTS = ["SANS", "SERIF", "MODERN"] as const;
export type AftersalesFont = (typeof AFTERSALES_FONTS)[number];

export const AFTERSALES_FONT_SIZES = ["COMPACT", "STANDAARD", "GROOT"] as const;
export type AftersalesFontSize = (typeof AFTERSALES_FONT_SIZES)[number];

export type AftersalesDesign = {
  layout: AftersalesLayout;
  font: AftersalesFont;
  fontSize: AftersalesFontSize;
  mediaUrl: string | null;
  mediaAlt: string;
};

export const defaultAftersalesDesign: AftersalesDesign = {
  layout: "CLASSIC",
  font: "SANS",
  fontSize: "STANDAARD",
  mediaUrl: null,
  mediaAlt: "",
};

export const aftersalesDesignSchema = z.object({
  layout: z.enum(AFTERSALES_LAYOUTS).default("CLASSIC"),
  font: z.enum(AFTERSALES_FONTS).default("SANS"),
  fontSize: z.enum(AFTERSALES_FONT_SIZES).default("STANDAARD"),
  mediaUrl: z.string().trim().url().nullable().default(null),
  mediaAlt: z.string().trim().max(200).default(""),
}).strict();

export type AftersalesStepContent = {
  locales: AftersalesContent;
  design: AftersalesDesign;
};

const allowedTokenSet = new Set<string>(AFTERSALES_TOKENS);

function onlySupportedTokens(value: string): boolean {
  return [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].every((match) =>
    allowedTokenSet.has(match[1])
  );
}

const personalizedText = (label: string, maxLength: number) =>
  z.string().trim().min(1, `${label} is verplicht`).max(maxLength).refine(
    onlySupportedTokens,
    `Gebruik alleen ondersteunde personalisatievelden: ${AFTERSALES_TOKENS.map((token) => `{{${token}}}`).join(", ")}`
  );

export const aftersalesLocaleContentSchema = z.object({
  subject: personalizedText("Onderwerp", 180),
  previewText: personalizedText("Previewtekst", 255),
  heading: personalizedText("Kop", 180),
  body: personalizedText("Bericht", 4000),
  buttonLabel: personalizedText("Knoptekst", 80),
}).strict();

export const aftersalesContentSchema = z.object(
  Object.fromEntries(locales.map((locale) => [locale, aftersalesLocaleContentSchema])) as Record<
    Locale,
    typeof aftersalesLocaleContentSchema
  >
).strict();

export const aftersalesStepContentSchema = z.object({
  locales: aftersalesContentSchema,
  design: aftersalesDesignSchema,
}).strict();

export const aftersalesStepInputSchema = z.object({
  id: z.string().trim().min(1).max(100),
  trigger: z.enum(AFTERSALES_TRIGGERS),
  name: z.string().trim().min(1, "Stapnaam is verplicht").max(100),
  position: z.number().int().min(0).max(20),
  enabled: z.boolean(),
  delayMinutes: z.literal(0),
  content: aftersalesStepContentSchema,
}).strict();

export const aftersalesFlowInputSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1, "Flownaam is verplicht").max(120),
  isActive: z.boolean(),
  logoUrl: z.string().trim().url().nullable(),
  version: z.string().datetime(),
  steps: z.array(aftersalesStepInputSchema).length(2),
}).strict().superRefine((input, context) => {
  const ids = new Set(input.steps.map((step) => step.id));
  const triggers = new Set(input.steps.map((step) => step.trigger));
  if (ids.size !== input.steps.length) {
    context.addIssue({ code: "custom", path: ["steps"], message: "Stap-ID's moeten uniek zijn." });
  }
  if (triggers.size !== AFTERSALES_TRIGGERS.length) {
    context.addIssue({
      code: "custom",
      path: ["steps"],
      message: "De flow moet precies één bestel- en één verzendstap bevatten.",
    });
  }
});

export type AftersalesFlowInput = z.infer<typeof aftersalesFlowInputSchema>;

// AftersalesStep.content is a flexible Json column. Steps saved before the
// design/layout feature shipped store the locale map directly (no wrapper);
// steps saved since store { locales, design }. Normalizing both shapes here
// means existing flows keep rendering exactly as before until an admin
// explicitly opens the editor and changes the design.
export function parseAftersalesContent(value: unknown): AftersalesStepContent {
  if (value && typeof value === "object" && "locales" in (value as Record<string, unknown>)) {
    const record = value as Record<string, unknown>;
    return {
      locales: aftersalesContentSchema.parse(record.locales),
      design: aftersalesDesignSchema.parse(record.design ?? {}),
    };
  }
  return {
    locales: aftersalesContentSchema.parse(value),
    design: defaultAftersalesDesign,
  };
}
