import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

import { renderBrandLogoPng } from "../lib/newsletter/brand-logo";
import {
  createNewsletterBlock,
  DEFAULT_NEWSLETTER_THEME,
  fontStack,
  googleFontFamily,
  isNewsletterFont,
  newsletterDocumentSchema,
  snapToGrid,
  type NewsletterBlock,
  type NewsletterDocument,
  type NewsletterTheme,
} from "../lib/newsletter/document";
import { columnWidths, googleFontsHref, renderNewsletterEmail } from "../lib/newsletter/render";
import { applyThemePreset, BUILT_IN_THEME_PRESETS, presetIdFromName, upsertThemePreset } from "../lib/newsletter/theme-presets";

const meta = { subject: "Onderwerp", previewText: "Voorproefje" };

function doc(blocks: NewsletterBlock[], theme: Partial<NewsletterTheme> = {}): NewsletterDocument {
  return { version: 1, theme: { ...DEFAULT_NEWSLETTER_THEME, ...theme }, blocks };
}

test("fonts: curated keys, any Google Font by name, nothing else", () => {
  assert.equal(isNewsletterFont("arial"), true);
  assert.equal(isNewsletterFont("montserrat"), true);
  assert.equal(isNewsletterFont("google:Josefin Sans"), true);
  assert.equal(isNewsletterFont("google:Bad<script>"), false);
  assert.equal(isNewsletterFont("comic"), false);
  assert.equal(googleFontFamily("arial"), null);
  assert.equal(googleFontFamily("open-sans"), "Open Sans");
  assert.equal(googleFontFamily("google:Josefin Sans"), "Josefin Sans");
  assert.match(fontStack("google:Josefin Sans"), /^'Josefin Sans', Arial/u);
  assert.equal(fontStack("unknown"), fontStack("arial"));
});

test("Google Fonts load with a stylesheet link and an Outlook fallback; web-safe themes load nothing", () => {
  assert.equal(googleFontsHref({ font: "arial", headingFont: null }), "");
  assert.equal(
    googleFontsHref({ font: "open-sans", headingFont: "google:Josefin Sans" }),
    "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&family=Josefin+Sans:wght@400;700&display=swap",
  );
  const html = renderNewsletterEmail(doc([createNewsletterBlock("heading")], { font: "montserrat", headingFont: "dosis" }), meta);
  assert.match(html, /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Montserrat:wght@400;700&amp;family=Dosis:wght@400;700&amp;display=swap" rel="stylesheet">/u);
  assert.match(html, /<!--\[if mso\]>/u);
  assert.match(html, /<h1 style="margin:0 0 12px;font-family:Dosis/u, "headings use the heading font");
  assert.doesNotMatch(renderNewsletterEmail(doc([createNewsletterBlock("heading")]), meta), /fonts\.googleapis/u);
});

test("spacing snaps to the grid", () => {
  assert.equal(snapToGrid(13, 8), 16);
  assert.equal(snapToGrid(11, 8), 8);
  assert.equal(snapToGrid(13, 4), 12);
  const spacer = { ...createNewsletterBlock("spacer"), height: 21 } as NewsletterBlock;
  assert.match(renderNewsletterEmail(doc([spacer], { gridSize: 16 }), meta), /height:16px/u);
  const styled = { ...createNewsletterBlock("text"), style: { background: "#fef3c7", paddingTop: 13, paddingBottom: 30 } } as NewsletterBlock;
  assert.match(renderNewsletterEmail(doc([styled], { gridSize: 8, paddingX: 24 }), meta), /background:#fef3c7;padding:16px 24px 32px/u);
});

test("two columns can be weighted and the gap follows the grid", () => {
  assert.deepEqual(columnWidths(2, "wide-left"), [66, 34]);
  assert.deepEqual(columnWidths(2, "wide-right"), [34, 66]);
  assert.deepEqual(columnWidths(3, "wide-left"), [33, 33, 33], "ratio only applies to two columns");
  const columns = { ...createNewsletterBlock("columns"), ratio: "wide-right", gap: 22 } as NewsletterBlock;
  const html = renderNewsletterEmail(doc([columns]), meta);
  assert.match(html, /width="34%" valign="top" style="width:34%;padding:0 24px 16px 0"/u);
  assert.match(html, /width="66%"/u);
});

test("a full-bleed image spans the mail without side padding", () => {
  const image = { ...createNewsletterBlock("image"), url: "https://cdn.example.com/banner.jpg", fullBleed: true } as NewsletterBlock;
  const html = renderNewsletterEmail(doc([image], { contentWidth: 640 }), meta);
  assert.match(html, /class="dnm-bleed" style="padding:0px 0px 0px"/u);
  assert.match(html, /width="640" style="display:block;width:100%/u);
});

test("outline buttons and a custom button radius", () => {
  const html = renderNewsletterEmail(doc([createNewsletterBlock("button")], { buttonStyle: "outline", buttonRadius: 30 }), meta);
  assert.match(html, /background:transparent;border:2px solid #596b2b;border-radius:30px/u);
});

test("the grid overlay only shows in the editor preview", () => {
  const document = doc([createNewsletterBlock("text")]);
  assert.match(renderNewsletterEmail(document, meta, { preview: true, showGrid: true }), /repeating-linear-gradient/u);
  assert.doesNotMatch(renderNewsletterEmail(document, meta, { showGrid: true }), /repeating-linear-gradient/u);
});

test("themes saved before fonts, grid and button options still open", () => {
  const newKeys = new Set(["headingFont", "paddingX", "gridSize", "buttonStyle", "buttonRadius"]);
  const oldTheme = Object.fromEntries(Object.entries(DEFAULT_NEWSLETTER_THEME).filter(([key]) => !newKeys.has(key)));
  const parsed = newsletterDocumentSchema.parse({
    version: 1,
    theme: oldTheme,
    blocks: [{ id: "c", type: "columns", count: 2, items: [
      { imageUrl: "", heading: "A", text: "", buttonText: "", buttonUrl: "" },
      { imageUrl: "", heading: "B", text: "", buttonText: "", buttonUrl: "" },
    ] }, { id: "i", type: "image", url: "", alt: "", linkUrl: "", width: 100, align: "center", rounded: true, caption: "" }],
  });
  assert.equal(parsed.theme.gridSize, 8);
  assert.equal(parsed.theme.paddingX, 32);
  assert.equal(parsed.theme.headingFont, null);
  assert.equal(parsed.theme.buttonStyle, "filled");
  const columns = parsed.blocks[0];
  assert.ok(columns.type === "columns" && columns.ratio === "equal" && columns.gap === 16);
  const image = parsed.blocks[1];
  assert.ok(image.type === "image" && image.fullBleed === false);
});

test("every built-in preset is a valid theme and keeps the editor's own header and footer text", () => {
  for (const preset of BUILT_IN_THEME_PRESETS) {
    assert.equal(newsletterDocumentSchema.safeParse(doc([createNewsletterBlock("text")], preset.theme)).success, true, preset.name);
  }
  const current = { ...DEFAULT_NEWSLETTER_THEME, header: { ...DEFAULT_NEWSLETTER_THEME.header, text: "Kerst bij De Notenman" }, footer: { ...DEFAULT_NEWSLETTER_THEME.footer, text: "Eigen voet" } };
  const applied = applyThemePreset(current, BUILT_IN_THEME_PRESETS[1].theme);
  assert.equal(applied.header.text, "Kerst bij De Notenman");
  assert.equal(applied.footer.text, "Eigen voet");
  assert.equal(applied.font, "montserrat");
});

test("saved house styles replace one with the same name", () => {
  assert.equal(presetIdFromName("Najaarsactie 2026!"), "najaarsactie-2026");
  assert.equal(presetIdFromName("Café"), "cafe");
  const first = upsertThemePreset([], "Najaar", DEFAULT_NEWSLETTER_THEME);
  const second = upsertThemePreset(first, "najaar", { ...DEFAULT_NEWSLETTER_THEME, accent: "#000000" });
  assert.equal(second.length, 1);
  assert.equal(second[0].theme.accent, "#000000");
});

test("the wordmark renders as a PNG in dark and white", async () => {
  const svg = await readFile("public/brand/logo-wordmark.svg");
  const dark = await renderBrandLogoPng(svg, "dark");
  const light = await renderBrandLogoPng(svg, "light");
  const darkMeta = await sharp(dark).metadata();
  assert.equal(darkMeta.format, "png");
  assert.equal(darkMeta.width, 720);
  const stats = await sharp(light).stats();
  // Every visible pixel of the white logo is white.
  assert.ok(stats.channels[0].max === 255 && stats.channels[0].min === 255, "red channel is white");
  assert.equal(stats.channels.length, 4, "keeps transparency");
});

test("each column's image gets its own width for Outlook", () => {
  const columns = { ...createNewsletterBlock("columns"), ratio: "wide-left", items: [
    { imageUrl: "https://cdn.example.com/a.jpg", heading: "A", text: "", buttonText: "", buttonUrl: "" },
    { imageUrl: "https://cdn.example.com/b.jpg", heading: "B", text: "", buttonText: "", buttonUrl: "" },
  ] } as NewsletterBlock;
  const html = renderNewsletterEmail(doc([columns], { contentWidth: 640, paddingX: 32 }), meta);
  assert.match(html, /a\.jpg" alt="A" width="380"/u);
  assert.match(html, /b\.jpg" alt="B" width="195"/u);
});
