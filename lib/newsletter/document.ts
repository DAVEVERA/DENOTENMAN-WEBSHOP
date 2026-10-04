import { z } from "zod";

import { VIDEO_THUMBNAIL_ASPECTS } from "./video";

// The newsletter as editable blocks. The same document renders the live preview and
// the HTML sent to Mailchimp, so what you see is what subscribers get.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/u, "Gebruik een kleur als #RRGGBB.");
const httpsUrl = z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u, "Gebruik een https-link.");
const linkUrl = z.string().trim().max(2_000).regex(/^(?:https?:\/\/\S+|mailto:\S+|\*\|[A-Z_:]+\|\*)$/u, "Gebruik een volledige link (https://…) of mailto:.");
const align = z.enum(["left", "center", "right"]);
const id = z.string().min(1).max(40);

type FontDefinition = { label: string; stack: string; google?: string };

// Web-safe fonts work everywhere. Google Fonts load in Apple Mail, iOS Mail, Samsung
// Mail and Thunderbird; Gmail and Outlook show the fallback in the same stack.
export const NEWSLETTER_FONTS = {
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  helvetica: { label: "Helvetica", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  trebuchet: { label: "Trebuchet MS", stack: "'Trebuchet MS', Tahoma, sans-serif" },
  georgia: { label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  montserrat: { label: "Montserrat (huisstijl)", stack: "Montserrat, Arial, Helvetica, sans-serif", google: "Montserrat" },
  dosis: { label: "Dosis (huisstijl)", stack: "Dosis, 'Trebuchet MS', Arial, sans-serif", google: "Dosis" },
  inter: { label: "Inter", stack: "Inter, Arial, Helvetica, sans-serif", google: "Inter" },
  roboto: { label: "Roboto", stack: "Roboto, Arial, Helvetica, sans-serif", google: "Roboto" },
  "open-sans": { label: "Open Sans", stack: "'Open Sans', Arial, Helvetica, sans-serif", google: "Open Sans" },
  lato: { label: "Lato", stack: "Lato, Arial, Helvetica, sans-serif", google: "Lato" },
  poppins: { label: "Poppins", stack: "Poppins, Arial, Helvetica, sans-serif", google: "Poppins" },
  nunito: { label: "Nunito", stack: "Nunito, Arial, Helvetica, sans-serif", google: "Nunito" },
  "dm-sans": { label: "DM Sans", stack: "'DM Sans', Arial, Helvetica, sans-serif", google: "DM Sans" },
  raleway: { label: "Raleway", stack: "Raleway, Arial, Helvetica, sans-serif", google: "Raleway" },
  "work-sans": { label: "Work Sans", stack: "'Work Sans', Arial, Helvetica, sans-serif", google: "Work Sans" },
  oswald: { label: "Oswald", stack: "Oswald, 'Arial Narrow', Arial, sans-serif", google: "Oswald" },
  "playfair-display": { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", google: "Playfair Display" },
  merriweather: { label: "Merriweather", stack: "Merriweather, Georgia, serif", google: "Merriweather" },
  lora: { label: "Lora", stack: "Lora, Georgia, serif", google: "Lora" },
  "libre-baskerville": { label: "Libre Baskerville", stack: "'Libre Baskerville', Georgia, serif", google: "Libre Baskerville" },
} as const satisfies Record<string, FontDefinition>;

export type NewsletterFontKey = keyof typeof NEWSLETTER_FONTS;
/** A key from NEWSLETTER_FONTS, or "google:<Family Name>" for any other Google Font. */
export type NewsletterFont = string;

const CUSTOM_GOOGLE_FONT = /^google:[A-Za-z][A-Za-z0-9 ]{1,39}$/u;

export function isNewsletterFont(value: string): boolean {
  return Object.hasOwn(NEWSLETTER_FONTS, value) || CUSTOM_GOOGLE_FONT.test(value);
}

function fontDefinition(font: string | null | undefined): FontDefinition | null {
  if (!font) return null;
  if (Object.hasOwn(NEWSLETTER_FONTS, font)) return NEWSLETTER_FONTS[font as NewsletterFontKey];
  if (CUSTOM_GOOGLE_FONT.test(font)) {
    const family = font.slice("google:".length).trim();
    return { label: family, stack: `'${family}', Arial, Helvetica, sans-serif`, google: family };
  }
  return null;
}

/** The CSS font-family stack for a font, falling back to Arial. */
export function fontStack(font: string | null | undefined): string {
  return fontDefinition(font)?.stack ?? NEWSLETTER_FONTS.arial.stack;
}

/** The Google Fonts family name to load for a font, or null for web-safe fonts. */
export function googleFontFamily(font: string | null | undefined): string | null {
  return fontDefinition(font)?.google ?? null;
}

export const NEWSLETTER_GRID_SIZES = [4, 8, 16] as const;

/** Rounds a spacing value to the layout grid, so blocks line up. */
export function snapToGrid(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}

const fontField = z.string().refine(isNewsletterFont, "Kies een lettertype uit de lijst of een geldige Google Font-naam.");

export const newsletterThemeSchema = z.object({
  font: fontField,
  /** Font for headings; null uses the body font. */
  headingFont: fontField.nullable().default(null),
  pageBackground: hex,
  contentBackground: hex,
  text: hex,
  heading: hex,
  accent: hex,
  accentText: hex,
  link: hex,
  headerBackground: hex,
  headerText: hex,
  footerBackground: hex,
  footerText: hex,
  contentWidth: z.number().int().min(480).max(720),
  radius: z.number().int().min(0).max(24),
  /** Side padding of the content, snapped to the grid. */
  paddingX: z.number().int().min(16).max(48).default(32),
  /** Spacing values snap to this grid. */
  gridSize: z.union([z.literal(4), z.literal(8), z.literal(16)]).default(8),
  buttonStyle: z.enum(["filled", "outline"]).default("filled"),
  /** Button corner radius; null follows the general radius. */
  buttonRadius: z.number().int().min(0).max(40).nullable().default(null),
  header: z.object({
    mode: z.enum(["text", "logo", "none"]),
    text: z.string().trim().max(80),
    logoUrl: httpsUrl.or(z.literal("")),
    logoWidth: z.number().int().min(60).max(400),
    align,
  }).strict(),
  footer: z.object({
    text: z.string().max(1_000),
    showArchiveLink: z.boolean(),
  }).strict(),
}).strict();

export type NewsletterTheme = z.infer<typeof newsletterThemeSchema>;

/** Optional per-block background and spacing, snapped to the theme grid when rendered. */
export const newsletterBlockStyleSchema = z.object({
  background: hex.nullable(),
  paddingTop: z.number().int().min(0).max(96),
  paddingBottom: z.number().int().min(0).max(96),
}).strict();

export type NewsletterBlockStyle = z.infer<typeof newsletterBlockStyleSchema>;

export const DEFAULT_BLOCK_STYLE: NewsletterBlockStyle = { background: null, paddingTop: 0, paddingBottom: 0 };

const headingBlock = z.object({ id, type: z.literal("heading"), text: z.string().trim().min(1, "Een kop mag niet leeg zijn.").max(200), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), align, color: hex.nullable() }).strict();
const textBlock = z.object({ id, type: z.literal("text"), text: z.string().max(10_000), align, fontSize: z.number().int().min(13).max(22) }).strict();
const imageBlock = z.object({
  id,
  type: z.literal("image"),
  url: httpsUrl.or(z.literal("")),
  alt: z.string().max(300),
  linkUrl: linkUrl.or(z.literal("")),
  width: z.number().int().min(20).max(100),
  align,
  rounded: z.boolean(),
  caption: z.string().max(300),
  /** Edge to edge, without the side padding; for banners and hero images. */
  fullBleed: z.boolean().default(false),
}).strict();
const videoBlock = z.object({
  id,
  type: z.literal("video"),
  videoUrl: httpsUrl.or(z.literal("")),
  thumbnailUrl: httpsUrl.or(z.literal("")),
  // The still the thumbnail was made from, so it can be remade in another shape.
  posterUrl: httpsUrl.or(z.literal("")).default(""),
  aspect: z.enum(VIDEO_THUMBNAIL_ASPECTS).default("16:9"),
  width: z.number().int().min(20).max(100).default(100),
  align: align.default("center"),
  title: z.string().max(200),
  caption: z.string().max(300),
}).strict();
const buttonBlock = z.object({ id, type: z.literal("button"), text: z.string().trim().min(1, "Geef de knop een tekst.").max(80), url: linkUrl, align, background: hex.nullable(), color: hex.nullable(), fullWidth: z.boolean() }).strict();
const iconsBlock = z.object({
  id,
  type: z.literal("icons"),
  items: z.array(z.object({ icon: z.string().trim().min(1).max(8), title: z.string().max(60), text: z.string().max(300) }).strict()).min(1).max(4),
}).strict();
const columnsBlock = z.object({
  id,
  type: z.literal("columns"),
  count: z.union([z.literal(2), z.literal(3)]),
  /** Column widths for two columns. */
  ratio: z.enum(["equal", "wide-left", "wide-right"]).default("equal"),
  gap: z.number().int().min(0).max(48).default(16),
  items: z.array(z.object({
    imageUrl: httpsUrl.or(z.literal("")),
    heading: z.string().max(120),
    text: z.string().max(1_000),
    buttonText: z.string().max(60),
    buttonUrl: linkUrl.or(z.literal("")),
  }).strict()).min(2).max(6),
}).strict();
const productsBlock = z.object({
  id,
  type: z.literal("products"),
  columns: z.union([z.literal(2), z.literal(3)]),
  buttonText: z.string().max(40),
  items: z.array(z.object({
    productId: z.string().max(40),
    name: z.string().max(180),
    imageUrl: httpsUrl.or(z.literal("")),
    priceLabel: z.string().max(40),
    url: linkUrl,
  }).strict()).max(9),
}).strict();
const tableBlock = z.object({ id, type: z.literal("table"), headers: z.array(z.string().max(80)).max(6), rows: z.array(z.array(z.string().max(300)).max(6)).min(1).max(30) }).strict();
const quoteBlock = z.object({ id, type: z.literal("quote"), text: z.string().trim().min(1).max(1_000), author: z.string().max(120) }).strict();
const dividerBlock = z.object({ id, type: z.literal("divider"), color: hex.nullable(), thickness: z.number().int().min(1).max(4) }).strict();
const spacerBlock = z.object({ id, type: z.literal("spacer"), height: z.number().int().min(8).max(96) }).strict();
const socialBlock = z.object({
  id,
  type: z.literal("social"),
  align,
  links: z.object({
    facebook: httpsUrl.or(z.literal("")),
    instagram: httpsUrl.or(z.literal("")),
    tiktok: httpsUrl.or(z.literal("")),
    youtube: httpsUrl.or(z.literal("")),
    website: httpsUrl.or(z.literal("")),
  }).strict(),
}).strict();
const htmlBlock = z.object({ id, type: z.literal("html"), html: z.string().max(50_000) }).strict();

const style = { style: newsletterBlockStyleSchema.optional() };

export const newsletterBlockSchema = z.discriminatedUnion("type", [
  headingBlock.extend(style), textBlock.extend(style), imageBlock.extend(style), videoBlock.extend(style),
  buttonBlock.extend(style), iconsBlock.extend(style), columnsBlock.extend(style), productsBlock.extend(style),
  tableBlock.extend(style), quoteBlock.extend(style), dividerBlock.extend(style), spacerBlock.extend(style),
  socialBlock.extend(style), htmlBlock.extend(style),
]);

export type NewsletterBlock = z.infer<typeof newsletterBlockSchema>;
export type NewsletterBlockType = NewsletterBlock["type"];

export const newsletterDocumentSchema = z.object({
  version: z.literal(1),
  theme: newsletterThemeSchema,
  blocks: z.array(newsletterBlockSchema).min(1, "Voeg ten minste één blok toe.").max(80),
}).strict();

export type NewsletterDocument = z.infer<typeof newsletterDocumentSchema>;

export const DEFAULT_NEWSLETTER_THEME: NewsletterTheme = {
  font: "arial",
  headingFont: null,
  pageBackground: "#f5f1e8",
  contentBackground: "#ffffff",
  text: "#24231f",
  heading: "#141414",
  accent: "#596b2b",
  accentText: "#ffffff",
  link: "#596b2b",
  headerBackground: "#596b2b",
  headerText: "#ffffff",
  footerBackground: "#eee8db",
  footerText: "#5d5a52",
  contentWidth: 640,
  radius: 16,
  paddingX: 32,
  gridSize: 8,
  buttonStyle: "filled",
  buttonRadius: null,
  header: { mode: "text", text: "De Notenman", logoUrl: "", logoWidth: 180, align: "left" },
  footer: { text: "Je ontvangt deze mail omdat je je hebt aangemeld voor de nieuwsbrief van De Notenman.", showArchiveLink: true },
};

let counter = 0;
export function newBlockId(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A fresh block of a type, with sensible Dutch starter content. */
export function createNewsletterBlock(type: NewsletterBlockType): NewsletterBlock {
  const blockId = newBlockId();
  switch (type) {
    case "heading": return { id: blockId, type, text: "Nieuw in de kraam", level: 1, align: "left", color: null };
    case "text": return { id: blockId, type, text: "Hallo *|FNAME|*,\n\nSchrijf hier je bericht. Maak woorden **vet** of *cursief* en voeg een [link](https://denotenman.com) toe.", align: "left", fontSize: 16 };
    case "image": return { id: blockId, type, url: "", alt: "", linkUrl: "", width: 100, align: "center", rounded: true, caption: "", fullBleed: false };
    case "video": return { id: blockId, type, videoUrl: "", thumbnailUrl: "", posterUrl: "", aspect: "16:9", width: 100, align: "center", title: "Bekijk de video", caption: "" };
    case "button": return { id: blockId, type, text: "Naar de webshop", url: "https://denotenman.com", align: "left", background: null, color: null, fullWidth: false };
    case "icons": return { id: blockId, type, items: [
      { icon: "🥜", title: "Vers gebrand", text: "Elke week uit eigen branderij." },
      { icon: "🚚", title: "Snel bezorgd", text: "Voor 16:00 besteld, morgen in huis." },
      { icon: "⭐", title: "Kwaliteit", text: "Met zorg geselecteerd." },
    ] };
    case "columns": return { id: blockId, type, count: 2, ratio: "equal", gap: 16, items: [
      { imageUrl: "", heading: "Eerste onderwerp", text: "Korte omschrijving.", buttonText: "", buttonUrl: "" },
      { imageUrl: "", heading: "Tweede onderwerp", text: "Korte omschrijving.", buttonText: "", buttonUrl: "" },
    ] };
    case "products": return { id: blockId, type, columns: 2, buttonText: "Bekijk", items: [] };
    case "table": return { id: blockId, type, headers: ["Product", "Prijs"], rows: [["", ""]] };
    case "quote": return { id: blockId, type, text: "Heerlijke noten, altijd vers!", author: "Een tevreden klant" };
    case "divider": return { id: blockId, type, color: null, thickness: 1 };
    case "spacer": return { id: blockId, type, height: 24 };
    case "social": return { id: blockId, type, align: "center", links: { facebook: "", instagram: "", tiktok: "", youtube: "", website: "https://denotenman.com" } };
    case "html": return { id: blockId, type, html: "<p>Eigen HTML</p>" };
  }
}

/** The starting point for a new newsletter. */
export function starterNewsletterDocument(): NewsletterDocument {
  return {
    version: 1,
    theme: structuredClone(DEFAULT_NEWSLETTER_THEME),
    blocks: [
      createNewsletterBlock("heading"),
      createNewsletterBlock("text"),
      createNewsletterBlock("button"),
      createNewsletterBlock("divider"),
      createNewsletterBlock("social"),
    ],
  };
}

/** Newsletters written before the block editor open as one HTML block in the classic design. */
export function documentFromLegacyHtml(contentHtml: string): NewsletterDocument {
  return {
    version: 1,
    theme: structuredClone(DEFAULT_NEWSLETTER_THEME),
    blocks: [{ id: newBlockId(), type: "html", html: contentHtml || "<p></p>" }],
  };
}
