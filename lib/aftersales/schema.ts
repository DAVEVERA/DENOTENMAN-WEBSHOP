import { z } from "zod";
import { locales, type Locale } from "@/lib/i18n";

export const PARTICULIER_TRIGGERS = ["ORDER_PAID", "ORDER_FULFILLED", "BACK_IN_STOCK"] as const;
export const BUSINESS_TRIGGERS = ["BUSINESS_ORDER_PAID", "BUSINESS_ORDER_FULFILLED"] as const;
export const AFTERSALES_TRIGGERS = [...PARTICULIER_TRIGGERS, ...BUSINESS_TRIGGERS] as const;
export type AftersalesTriggerValue = (typeof AFTERSALES_TRIGGERS)[number];

export const AFTERSALES_TRIGGERS_BY_FLOW_TYPE: Record<"PARTICULIER" | "ZAKELIJK", readonly AftersalesTriggerValue[]> = {
  PARTICULIER: PARTICULIER_TRIGGERS,
  ZAKELIJK: BUSINESS_TRIGGERS,
};

export const AFTERSALES_TOKENS = [
  "first_name",
  "customer_name",
  "order_number",
  "order_total",
  "tracking_code",
  "order_url",
  "product_name",
  "product_url",
  "business_name",
  "contact_name",
] as const;

export const AFTERSALES_TOKENS_BY_TRIGGER: Record<AftersalesTriggerValue, readonly string[]> = {
  ORDER_PAID: AFTERSALES_TOKENS.filter((token) => !token.startsWith("product_") && token !== "business_name" && token !== "contact_name"),
  ORDER_FULFILLED: AFTERSALES_TOKENS.filter((token) => !token.startsWith("product_") && token !== "business_name" && token !== "contact_name"),
  BACK_IN_STOCK: ["product_name", "product_url"],
  BUSINESS_ORDER_PAID: ["business_name", "contact_name", "order_number", "order_total", "order_url"],
  BUSINESS_ORDER_FULFILLED: ["business_name", "contact_name", "order_number", "tracking_code", "order_url"],
};

export type AftersalesLocaleContent = {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  buttonLabel: string;
};

export type AftersalesContent = Record<Locale, AftersalesLocaleContent>;

export const AFTERSALES_LAYOUTS = ["CLASSIC", "IMAGE_TOP", "IMAGE_SIDE", "IMAGE_BOTTOM", "GRID_2COL", "TABLE"] as const;
export type AftersalesLayout = (typeof AFTERSALES_LAYOUTS)[number];

export const AFTERSALES_FONTS = ["SANS", "SERIF", "MODERN"] as const;
export type AftersalesFont = (typeof AFTERSALES_FONTS)[number];

export const AFTERSALES_FONT_SIZES = ["COMPACT", "STANDAARD", "GROOT"] as const;
export type AftersalesFontSize = (typeof AFTERSALES_FONT_SIZES)[number];

export type AftersalesGridItem = {
  imageUrl: string | null;
  imageAlt: string;
  heading: string;
  body: string;
};

export type AftersalesTableRow = { cells: string[] };

export type AftersalesDesign = {
  layout: AftersalesLayout;
  font: AftersalesFont;
  fontSize: AftersalesFontSize;
  mediaUrl: string | null;
  mediaAlt: string;
  // Only rendered when layout is GRID_2COL - up to 4 image+text cards laid
  // out two per row (a real HTML table under the hood, for email-client
  // compatibility, not CSS grid).
  gridItems: AftersalesGridItem[];
  // Only rendered when layout is TABLE - a simple data table (e.g. a price
  // list) below the main text.
  tableHeaders: string[];
  tableRows: AftersalesTableRow[];
};

export const defaultAftersalesDesign: AftersalesDesign = {
  layout: "CLASSIC",
  font: "SANS",
  fontSize: "STANDAARD",
  mediaUrl: null,
  mediaAlt: "",
  gridItems: [],
  tableHeaders: [],
  tableRows: [],
};

const MAX_GRID_ITEMS = 4;
const MAX_TABLE_ROWS = 20;
const MAX_TABLE_COLUMNS = 6;

const aftersalesGridItemSchema = z.object({
  imageUrl: z.string().trim().url().nullable().default(null),
  imageAlt: z.string().trim().max(200).default(""),
  heading: z.string().trim().max(120).default(""),
  body: z.string().trim().max(400).default(""),
}).strict();

const aftersalesTableRowSchema = z.object({
  cells: z.array(z.string().trim().max(200)).max(MAX_TABLE_COLUMNS),
}).strict();

export const aftersalesDesignSchema = z.object({
  layout: z.enum(AFTERSALES_LAYOUTS).default("CLASSIC"),
  font: z.enum(AFTERSALES_FONTS).default("SANS"),
  fontSize: z.enum(AFTERSALES_FONT_SIZES).default("STANDAARD"),
  mediaUrl: z.string().trim().url().nullable().default(null),
  mediaAlt: z.string().trim().max(200).default(""),
  gridItems: z.array(aftersalesGridItemSchema).max(MAX_GRID_ITEMS).default([]),
  tableHeaders: z.array(z.string().trim().max(80)).max(MAX_TABLE_COLUMNS).default([]),
  tableRows: z.array(aftersalesTableRowSchema).max(MAX_TABLE_ROWS).default([]),
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
}).strict().superRefine((step, context) => {
  const allowed = new Set(AFTERSALES_TOKENS_BY_TRIGGER[step.trigger]);
  for (const locale of locales) {
    for (const [field, value] of Object.entries(step.content.locales[locale])) {
      for (const match of value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        if (!allowed.has(match[1])) context.addIssue({
          code: "custom",
          path: ["content", "locales", locale, field],
          message: `Personalisatieveld {{${match[1]}}} is niet beschikbaar voor deze mailstap.`,
        });
      }
    }
  }
});

export const aftersalesFlowInputSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1, "Flownaam is verplicht").max(120),
  flowType: z.enum(["PARTICULIER", "ZAKELIJK"]),
  isActive: z.boolean(),
  logoUrl: z.string().trim().url().nullable(),
  version: z.string().datetime(),
  steps: z.array(aftersalesStepInputSchema).min(1).max(AFTERSALES_TRIGGERS.length),
}).strict().superRefine((input, context) => {
  const expectedTriggers = AFTERSALES_TRIGGERS_BY_FLOW_TYPE[input.flowType];
  const ids = new Set(input.steps.map((step) => step.id));
  const triggers = new Set(input.steps.map((step) => step.trigger));
  if (ids.size !== input.steps.length) {
    context.addIssue({ code: "custom", path: ["steps"], message: "Stap-ID's moeten uniek zijn." });
  }
  if (input.steps.length !== expectedTriggers.length || triggers.size !== expectedTriggers.length) {
    context.addIssue({
      code: "custom",
      path: ["steps"],
      message: "De flow moet precies één stap per triggertype van dit flowtype bevatten.",
    });
  }
  for (const step of input.steps) {
    if (!expectedTriggers.includes(step.trigger)) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: `Trigger ${step.trigger} hoort niet bij flowtype ${input.flowType}.`,
      });
    }
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
