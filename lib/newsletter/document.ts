import { z } from "zod";

// The newsletter as editable blocks. The same document renders the live preview and
// the HTML sent to Mailchimp, so what you see is what subscribers get.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/u, "Gebruik een kleur als #RRGGBB.");
const httpsUrl = z.string().trim().max(2_000).regex(/^https:\/\/\S+$/u, "Gebruik een https-link.");
const linkUrl = z.string().trim().max(2_000).regex(/^(?:https?:\/\/\S+|mailto:\S+|\*\|[A-Z_:]+\|\*)$/u, "Gebruik een volledige link (https://…) of mailto:.");
const align = z.enum(["left", "center", "right"]);
const id = z.string().min(1).max(40);

export const NEWSLETTER_FONTS = {
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  helvetica: { label: "Helvetica", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  trebuchet: { label: "Trebuchet MS", stack: "'Trebuchet MS', Tahoma, sans-serif" },
  georgia: { label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
} as const;

export type NewsletterFont = keyof typeof NEWSLETTER_FONTS;

export const newsletterThemeSchema = z.object({
  font: z.enum(Object.keys(NEWSLETTER_FONTS) as [NewsletterFont, ...NewsletterFont[]]),
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

const headingBlock = z.object({ id, type: z.literal("heading"), text: z.string().trim().min(1, "Een kop mag niet leeg zijn.").max(200), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), align, color: hex.nullable() }).strict();
const textBlock = z.object({ id, type: z.literal("text"), text: z.string().max(10_000), align, fontSize: z.number().int().min(13).max(22) }).strict();
const imageBlock = z.object({ id, type: z.literal("image"), url: httpsUrl.or(z.literal("")), alt: z.string().max(300), linkUrl: linkUrl.or(z.literal("")), width: z.number().int().min(20).max(100), align, rounded: z.boolean(), caption: z.string().max(300) }).strict();
const videoBlock = z.object({ id, type: z.literal("video"), videoUrl: httpsUrl.or(z.literal("")), thumbnailUrl: httpsUrl.or(z.literal("")), title: z.string().max(200), caption: z.string().max(300) }).strict();
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

export const newsletterBlockSchema = z.discriminatedUnion("type", [
  headingBlock, textBlock, imageBlock, videoBlock, buttonBlock, iconsBlock, columnsBlock, productsBlock,
  tableBlock, quoteBlock, dividerBlock, spacerBlock, socialBlock, htmlBlock,
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
    case "image": return { id: blockId, type, url: "", alt: "", linkUrl: "", width: 100, align: "center", rounded: true, caption: "" };
    case "video": return { id: blockId, type, videoUrl: "", thumbnailUrl: "", title: "Bekijk de video", caption: "" };
    case "button": return { id: blockId, type, text: "Naar de webshop", url: "https://denotenman.com", align: "left", background: null, color: null, fullWidth: false };
    case "icons": return { id: blockId, type, items: [
      { icon: "🥜", title: "Vers gebrand", text: "Elke week uit eigen branderij." },
      { icon: "🚚", title: "Snel bezorgd", text: "Voor 16:00 besteld, morgen in huis." },
      { icon: "⭐", title: "Kwaliteit", text: "Met zorg geselecteerd." },
    ] };
    case "columns": return { id: blockId, type, count: 2, items: [
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
