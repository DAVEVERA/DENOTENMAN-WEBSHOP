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

export type AftersalesLegacyLocaleContent = {
  subject: string;
  previewText: string;
  heading: string;
  body: string;
  buttonLabel: string;
};

export type AftersalesLegacyContent = Record<Locale, AftersalesLegacyLocaleContent>;

/** The fully-resolved shape every consumer downstream of parseAftersalesContent
 * works with — blockText is always present (never optional), so no caller
 * needs a null check. Hand-authored seed content (lib/aftersales/defaults.ts)
 * is typed as AftersalesLegacyLocaleContent instead and gets resolved via
 * resolveLegacyStepContent before it ever reaches this type. */
export type AftersalesLocaleContent = AftersalesLegacyLocaleContent & {
  blockText: Record<string, string>;
};

export type AftersalesContent = Record<Locale, AftersalesLocaleContent>;

export const AFTERSALES_LAYOUTS = ["CLASSIC", "IMAGE_TOP", "IMAGE_SIDE", "IMAGE_BOTTOM", "GRID_2COL", "TABLE"] as const;
export type AftersalesLayout = (typeof AFTERSALES_LAYOUTS)[number];

export const AFTERSALES_FONTS = ["SANS", "SERIF", "MODERN"] as const;
export type AftersalesFont = (typeof AFTERSALES_FONTS)[number];

export const AFTERSALES_FONT_SIZES = ["COMPACT", "STANDAARD", "GROOT"] as const;
export type AftersalesFontSize = (typeof AFTERSALES_FONT_SIZES)[number];

export const AFTERSALES_BLOCK_TYPES = [
  "text",
  "image",
  "hero",
  "banner",
  "button",
  "table",
  "grid",
  "footer",
  "spacer",
  "customHtml",
] as const;
export type AftersalesBlockType = (typeof AFTERSALES_BLOCK_TYPES)[number];

export type AftersalesTextAlign = "left" | "center" | "right";

export type AftersalesTextBlock = {
  id: string;
  type: "text";
  font: AftersalesFont;
  size: AftersalesFontSize;
  color: string;
  align: AftersalesTextAlign;
  bold: boolean;
  italic: boolean;
};

export type AftersalesImageBlock = {
  id: string;
  type: "image";
  mediaUrl: string | null;
  alt: string;
  width: number;
  align: AftersalesTextAlign;
  linkUrl: string | null;
};

export type AftersalesHeroBlock = {
  id: string;
  type: "hero";
  backgroundUrl: string | null;
  backgroundColor: string;
  buttonColor: string;
  buttonTextColor: string;
};

export type AftersalesBannerBlock = {
  id: string;
  type: "banner";
  backgroundUrl: string | null;
  backgroundColor: string;
  textColor: string;
};

export type AftersalesButtonBlock = {
  id: string;
  type: "button";
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  linkUrl: string | null;
};

export type AftersalesCanvasTableBlock = {
  id: string;
  type: "table";
  headerCount: number;
  rowIds: string[];
};

export type AftersalesCanvasGridItem = { id: string; imageUrl: string | null; imageAlt: string };

export type AftersalesCanvasGridBlock = {
  id: string;
  type: "grid";
  items: AftersalesCanvasGridItem[];
};

export type AftersalesFooterBlock = { id: string; type: "footer" };

export type AftersalesSpacerBlock = { id: string; type: "spacer"; heightPx: number; showDivider: boolean };

export type AftersalesCustomHtmlBlock = { id: string; type: "customHtml" };

export type AftersalesBlock =
  | AftersalesTextBlock
  | AftersalesImageBlock
  | AftersalesHeroBlock
  | AftersalesBannerBlock
  | AftersalesButtonBlock
  | AftersalesCanvasTableBlock
  | AftersalesCanvasGridBlock
  | AftersalesFooterBlock
  | AftersalesSpacerBlock
  | AftersalesCustomHtmlBlock;

export type AftersalesColumn = {
  id: string;
  widthFraction: number;
  backgroundColor: string;
  padding: number;
  blocks: AftersalesBlock[];
};

export type AftersalesRow = {
  id: string;
  backgroundColor: string;
  padding: number;
  columns: AftersalesColumn[];
};

export type AftersalesCanvas = { rows: AftersalesRow[] };

/** Composes the key a text-bearing block's value lives under in a locale's
 * blockText map. Single-text blocks (text/banner/footer/button/customHtml)
 * omit `field`; multi-text blocks (hero/table/grid) pass one per value. */
export function blockTextKey(blockId: string, field?: string): string {
  return field ? `${blockId}:${field}` : blockId;
}

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

const MAX_CANVAS_BLOCKS_PER_COLUMN = 20;
const MAX_CANVAS_COLUMNS_PER_ROW = 4;
const MAX_CANVAS_ROWS = 30;

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Gebruik een hexkleur zoals #E0B200");
const alignSchema = z.enum(["left", "center", "right"]);
const optionalUrlSchema = z.string().trim().url().nullable();
const blockIdSchema = z.string().trim().min(1).max(40);

const textBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("text"),
  font: z.enum(AFTERSALES_FONTS),
  size: z.enum(AFTERSALES_FONT_SIZES),
  color: hexColorSchema,
  align: alignSchema,
  bold: z.boolean(),
  italic: z.boolean(),
}).strict();

const imageBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("image"),
  mediaUrl: optionalUrlSchema,
  alt: z.string().trim().max(200),
  width: z.number().int().min(20).max(600),
  align: alignSchema,
  linkUrl: optionalUrlSchema,
}).strict();

const heroBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("hero"),
  backgroundUrl: optionalUrlSchema,
  backgroundColor: hexColorSchema,
  buttonColor: hexColorSchema,
  buttonTextColor: hexColorSchema,
}).strict();

const bannerBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("banner"),
  backgroundUrl: optionalUrlSchema,
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
}).strict();

const buttonBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("button"),
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  borderRadius: z.number().int().min(0).max(40),
  linkUrl: optionalUrlSchema,
}).strict();

const canvasTableBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("table"),
  headerCount: z.number().int().min(0).max(MAX_TABLE_COLUMNS),
  rowIds: z.array(blockIdSchema).max(MAX_TABLE_ROWS),
}).strict();

const canvasGridItemSchema = z.object({
  id: blockIdSchema,
  imageUrl: optionalUrlSchema,
  imageAlt: z.string().trim().max(200),
}).strict();

const canvasGridBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("grid"),
  items: z.array(canvasGridItemSchema).max(MAX_GRID_ITEMS),
}).strict();

const footerBlockSchema = z.object({ id: blockIdSchema, type: z.literal("footer") }).strict();

const spacerBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("spacer"),
  heightPx: z.number().int().min(4).max(120),
  showDivider: z.boolean(),
}).strict();

const customHtmlBlockSchema = z.object({ id: blockIdSchema, type: z.literal("customHtml") }).strict();

export const aftersalesBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  heroBlockSchema,
  bannerBlockSchema,
  buttonBlockSchema,
  canvasTableBlockSchema,
  canvasGridBlockSchema,
  footerBlockSchema,
  spacerBlockSchema,
  customHtmlBlockSchema,
]);

export const aftersalesColumnSchema = z.object({
  id: blockIdSchema,
  widthFraction: z.number().min(0.1).max(1),
  backgroundColor: hexColorSchema,
  padding: z.number().int().min(0).max(80),
  blocks: z.array(aftersalesBlockSchema).max(MAX_CANVAS_BLOCKS_PER_COLUMN),
}).strict();

export const aftersalesRowSchema = z.object({
  id: blockIdSchema,
  backgroundColor: hexColorSchema,
  padding: z.number().int().min(0).max(80),
  columns: z.array(aftersalesColumnSchema).min(1).max(MAX_CANVAS_COLUMNS_PER_ROW),
}).strict();

export const aftersalesCanvasSchema = z.object({
  rows: z.array(aftersalesRowSchema).min(1).max(MAX_CANVAS_ROWS),
}).strict();

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

export type AftersalesLegacyStepContent = {
  locales: AftersalesLegacyContent;
  design: AftersalesDesign;
};

export type AftersalesStepContent = {
  locales: AftersalesContent;
  design: AftersalesDesign;
  canvas: AftersalesCanvas;
};

const HEADING_TEXT_COLOR = "#141414";
const BODY_TEXT_COLOR = "#4f4a42";
const BRAND_BUTTON_COLOR = "#e0b200";
const BRAND_BUTTON_TEXT_COLOR = "#141414";
const WHITE = "#ffffff";

function textBlock(id: string, opts: { size: AftersalesFontSize; bold?: boolean; color?: string }, design: AftersalesDesign): AftersalesTextBlock {
  return {
    id,
    type: "text",
    font: design.font,
    size: opts.size,
    color: opts.color ?? (opts.bold ? HEADING_TEXT_COLOR : BODY_TEXT_COLOR),
    align: "left",
    bold: opts.bold ?? false,
    italic: false,
  };
}

function buttonBlock(id: string): AftersalesButtonBlock {
  return { id, type: "button", backgroundColor: BRAND_BUTTON_COLOR, textColor: BRAND_BUTTON_TEXT_COLOR, borderRadius: 8, linkUrl: null };
}

function imageBlock(id: string, design: AftersalesDesign, width: number): AftersalesImageBlock {
  return { id, type: "image", mediaUrl: design.mediaUrl, alt: design.mediaAlt, width, align: "center", linkUrl: null };
}

function column(id: string, widthFraction: number, blocks: AftersalesBlock[]): AftersalesColumn {
  return { id, widthFraction, backgroundColor: WHITE, padding: 0, blocks };
}

function row(id: string, columns: AftersalesColumn[]): AftersalesRow {
  return { id, backgroundColor: WHITE, padding: 24, columns };
}

/** Derives a canvas (and the blockText each locale needs) from a step's
 * legacy design + per-locale content. Pure and deterministic: the same
 * design/content always produces the same block ids, so tests and the
 * lazy-migration call site in parseAftersalesContent can both rely on it.
 * Grid-item and table text were locale-independent in the legacy design (a
 * single value shared by nl/en/fr) — that value is copied into every
 * locale's blockText here, so nothing regresses, while going forward an
 * admin can give each language its own text through the new blockText map. */
export function deriveCanvasFromLegacyContent(
  design: AftersalesDesign,
  legacyLocales: AftersalesLegacyContent
): { canvas: AftersalesCanvas; blockTextByLocale: Record<Locale, Record<string, string>> } {
  const blockTextByLocale: Record<Locale, Record<string, string>> = { nl: {}, en: {}, fr: {} };
  for (const locale of locales) {
    blockTextByLocale[locale][blockTextKey("heading")] = legacyLocales[locale].heading;
    blockTextByLocale[locale][blockTextKey("body")] = legacyLocales[locale].body;
    blockTextByLocale[locale][blockTextKey("button")] = legacyLocales[locale].buttonLabel;
  }

  const heading = textBlock("heading", { size: design.fontSize, bold: true }, design);
  const body = textBlock("body", { size: design.fontSize }, design);
  const button = buttonBlock("button");

  let columns: AftersalesColumn[];
  if (design.layout === "IMAGE_SIDE" && design.mediaUrl) {
    columns = [column("media-col", 0.35, [imageBlock("media", design, 200)]), column("text-col", 0.65, [heading, body, button])];
  } else if (design.layout === "IMAGE_TOP" && design.mediaUrl) {
    columns = [column("main", 1, [imageBlock("media", design, 544), heading, body, button])];
  } else if (design.layout === "IMAGE_BOTTOM" && design.mediaUrl) {
    columns = [column("main", 1, [heading, body, imageBlock("media", design, 544), button])];
  } else if (design.layout === "GRID_2COL" && design.gridItems.length > 0) {
    const items: AftersalesCanvasGridItem[] = design.gridItems.map((item, index) => ({
      id: `grid-item-${index}`,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
    }));
    for (const [index, item] of design.gridItems.entries()) {
      const itemId = items[index].id;
      for (const locale of locales) {
        blockTextByLocale[locale][blockTextKey(itemId, "heading")] = item.heading;
        blockTextByLocale[locale][blockTextKey(itemId, "body")] = item.body;
      }
    }
    const gridBlock: AftersalesCanvasGridBlock = { id: "grid", type: "grid", items };
    columns = [column("main", 1, [heading, body, gridBlock, button])];
  } else if (design.layout === "TABLE" && design.tableRows.length > 0) {
    const rowIds = design.tableRows.map((_, index) => `table-row-${index}`);
    for (const [colIndex, header] of design.tableHeaders.entries()) {
      for (const locale of locales) blockTextByLocale[locale][blockTextKey("table", `header:${colIndex}`)] = header;
    }
    for (const [rowIndex, tableRow] of design.tableRows.entries()) {
      for (const [colIndex, cell] of tableRow.cells.entries()) {
        for (const locale of locales) {
          blockTextByLocale[locale][blockTextKey("table", `cell:${rowIds[rowIndex]}:${colIndex}`)] = cell;
        }
      }
    }
    const tableBlock: AftersalesCanvasTableBlock = { id: "table", type: "table", headerCount: design.tableHeaders.length, rowIds };
    columns = [column("main", 1, [heading, body, tableBlock, button])];
  } else {
    columns = [column("main", 1, [heading, body, button])];
  }

  return { canvas: { rows: [row("main-row", columns)] }, blockTextByLocale };
}

/** Resolves a hand-authored, legacy-shaped seed (lib/aftersales/defaults.ts)
 * into the fully-resolved AftersalesStepContent shape, using the same
 * derivation new-content-without-a-canvas uses when read from the database.
 * There is only one code path that ever produces a canvas from legacy
 * design+text — this function and parseAftersalesContent's fallback branch
 * both call deriveCanvasFromLegacyContent, never duplicate its logic. */
export function resolveLegacyStepContent(legacy: AftersalesLegacyStepContent): AftersalesStepContent {
  const { canvas, blockTextByLocale } = deriveCanvasFromLegacyContent(legacy.design, legacy.locales);
  const resolvedLocales = Object.fromEntries(
    locales.map((locale) => [locale, { ...legacy.locales[locale], blockText: blockTextByLocale[locale] }])
  ) as AftersalesContent;
  return { locales: resolvedLocales, design: legacy.design, canvas };
}

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

export const aftersalesLegacyLocaleContentSchema = z.object({
  subject: personalizedText("Onderwerp", 180),
  previewText: personalizedText("Previewtekst", 255),
  heading: personalizedText("Kop", 180),
  body: personalizedText("Bericht", 4000),
  buttonLabel: personalizedText("Knoptekst", 80),
}).strict();

export const aftersalesLegacyContentSchema = z.object(
  Object.fromEntries(locales.map((locale) => [locale, aftersalesLegacyLocaleContentSchema])) as Record<
    Locale,
    typeof aftersalesLegacyLocaleContentSchema
  >
).strict();

export const aftersalesLocaleContentSchema = aftersalesLegacyLocaleContentSchema.extend({
  blockText: z.record(z.string().min(1).max(80), z.string().max(4000)).default({}),
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
  canvas: aftersalesCanvasSchema,
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
    const localeContent = step.content.locales[locale];
    for (const [field, value] of Object.entries(localeContent)) {
      if (field === "blockText") continue;
      for (const match of (value as string).matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        if (!allowed.has(match[1])) context.addIssue({
          code: "custom",
          path: ["content", "locales", locale, field],
          message: `Personalisatieveld {{${match[1]}}} is niet beschikbaar voor deze mailstap.`,
        });
      }
    }
    for (const [blockId, text] of Object.entries(localeContent.blockText)) {
      for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        if (!allowed.has(match[1])) context.addIssue({
          code: "custom",
          path: ["content", "locales", locale, "blockText", blockId],
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
// steps saved since (but before the canvas editor) store { locales, design }
// with no canvas; steps saved by the canvas editor store { locales, design,
// canvas } with canvas as the source of truth. Normalizing all three shapes
// here means existing flows keep rendering exactly as before until an admin
// explicitly opens the editor and saves.
export function parseAftersalesContent(value: unknown): AftersalesStepContent {
  if (value && typeof value === "object" && "locales" in (value as Record<string, unknown>)) {
    const record = value as Record<string, unknown>;
    const design = aftersalesDesignSchema.parse(record.design ?? {});
    if (record.canvas) {
      return {
        locales: aftersalesContentSchema.parse(record.locales),
        design,
        canvas: aftersalesCanvasSchema.parse(record.canvas),
      };
    }
    const legacyLocales = aftersalesLegacyContentSchema.parse(record.locales);
    return resolveLegacyStepContent({ locales: legacyLocales, design });
  }
  const legacyLocales = aftersalesLegacyContentSchema.parse(value);
  return resolveLegacyStepContent({ locales: legacyLocales, design: defaultAftersalesDesign });
}
