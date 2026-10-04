import { z } from "zod";

import { DEFAULT_NEWSLETTER_THEME, newsletterThemeSchema, type NewsletterTheme } from "./document";

// Ready-made looks for the newsletter, plus the shape of house styles an editor saves.
// Built-in presets keep the editor's header text, logo and footer text; they only
// change the look.

export type NewsletterThemePreset = { id: string; name: string; theme: NewsletterTheme };

function preset(id: string, name: string, changes: Partial<NewsletterTheme>): NewsletterThemePreset {
  return { id, name, theme: { ...DEFAULT_NEWSLETTER_THEME, ...changes } };
}

export const BUILT_IN_THEME_PRESETS: NewsletterThemePreset[] = [
  preset("classic", "Klassiek groen", {}),
  preset("brand", "Huisstijl De Notenman", {
    font: "montserrat",
    headingFont: "dosis",
    pageBackground: "#f6f3ee",
    contentBackground: "#ffffff",
    text: "#333333",
    heading: "#141414",
    accent: "#e0b200",
    accentText: "#141414",
    link: "#806600",
    headerBackground: "#141414",
    headerText: "#ffffff",
    footerBackground: "#f6f3ee",
    footerText: "#6e675c",
    radius: 12,
  }),
  preset("autumn", "Herfst", {
    font: "lato",
    headingFont: "playfair-display",
    pageBackground: "#f4ece1",
    text: "#3b2f25",
    heading: "#5a3a1e",
    accent: "#b5651d",
    accentText: "#ffffff",
    link: "#8a4b12",
    headerBackground: "#5a3a1e",
    headerText: "#fff6ea",
    footerBackground: "#ecdfcd",
    footerText: "#6b5a49",
    radius: 16,
  }),
  preset("business", "Zakelijk", {
    font: "helvetica",
    headingFont: null,
    pageBackground: "#eef0f2",
    text: "#2b2f33",
    heading: "#111418",
    accent: "#1f3a5f",
    accentText: "#ffffff",
    link: "#1f3a5f",
    headerBackground: "#ffffff",
    headerText: "#1f3a5f",
    footerBackground: "#e3e7eb",
    footerText: "#55606b",
    radius: 4,
    buttonStyle: "outline",
    buttonRadius: 4,
  }),
  preset("minimal", "Minimaal", {
    font: "inter",
    headingFont: null,
    pageBackground: "#ffffff",
    contentBackground: "#ffffff",
    text: "#222222",
    heading: "#000000",
    accent: "#000000",
    accentText: "#ffffff",
    link: "#000000",
    headerBackground: "#ffffff",
    headerText: "#000000",
    footerBackground: "#ffffff",
    footerText: "#666666",
    radius: 0,
    buttonRadius: 0,
  }),
  preset("holidays", "Feestdagen", {
    font: "nunito",
    headingFont: "merriweather",
    pageBackground: "#f3ede4",
    text: "#2d2a26",
    heading: "#7a1f1f",
    accent: "#7a1f1f",
    accentText: "#ffffff",
    link: "#2f5d3a",
    headerBackground: "#2f5d3a",
    headerText: "#ffffff",
    footerBackground: "#e9e0d2",
    footerText: "#5f574c",
    radius: 16,
    buttonRadius: 40,
  }),
];

/** Applies a preset's look while keeping the newsletter's own header, logo and footer text. */
export function applyThemePreset(current: NewsletterTheme, presetTheme: NewsletterTheme): NewsletterTheme {
  return {
    ...presetTheme,
    header: { ...presetTheme.header, text: current.header.text, logoUrl: current.header.logoUrl, mode: current.header.mode },
    footer: { ...presetTheme.footer, text: current.footer.text },
  };
}

export const MAX_SAVED_PRESETS = 24;

export const savedThemePresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/u),
  name: z.string().trim().min(1, "Geef de huisstijl een naam.").max(60),
  theme: newsletterThemeSchema,
}).strict();

export const savedThemePresetsSchema = z.array(savedThemePresetSchema).max(MAX_SAVED_PRESETS);

export const saveThemePresetInputSchema = z.object({
  name: z.string().trim().min(1, "Geef de huisstijl een naam.").max(60),
  theme: newsletterThemeSchema,
}).strict();

export function presetIdFromName(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 40);
  return slug || "huisstijl";
}

/** Adds a saved house style, replacing one with the same name. */
export function upsertThemePreset(presets: NewsletterThemePreset[], name: string, theme: NewsletterTheme): NewsletterThemePreset[] {
  const id = presetIdFromName(name);
  const next = presets.filter((item) => item.id !== id);
  next.unshift({ id, name: name.trim(), theme });
  return next.slice(0, MAX_SAVED_PRESETS);
}
