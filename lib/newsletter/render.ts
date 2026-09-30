import { sanitizeNewsletterContent } from "@/lib/mailchimp/template";
import {
  DEFAULT_NEWSLETTER_THEME,
  NEWSLETTER_FONTS,
  type NewsletterBlock,
  type NewsletterDocument,
  type NewsletterTheme,
} from "./document";

// Email-safe HTML from a newsletter document: tables, inline styles and a small
// <style> block that stacks columns on phones. Every piece of text is escaped here,
// so the output is safe whatever the editor holds; only the "html" block passes
// through the existing newsletter sanitizer.

export const NEWSLETTER_SAMPLE_VALUES: Record<string, string> = {
  "*|FNAME|*": "Fedor",
  "*|LNAME|*": "Jansen",
  "*|EMAIL|*": "klant@voorbeeld.nl",
  "*|LIST:ADDRESS|*": "De Notenman · Oude Baan 7a · 5076 PJ Haaren",
  "*|UNSUB|*": "#",
  "*|ARCHIVE|*": "#",
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function color(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/u.test(value) ? value : fallback;
}

function safeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (/^(?:https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|\*\|[A-Z_:]+\|\*)$/u.test(trimmed)) return trimmed;
  return null;
}

function httpsOnly(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return /^https:\/\/[^\s"'<>]+$/u.test(trimmed) ? trimmed : null;
}

function inline(text: string, theme: NewsletterTheme): string {
  // Escape first, then add the small set of markup the editor offers.
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]{1,200})\]\(([^)\s]{1,2000})\)/gu, (match, label: string, href: string) => {
    const url = safeUrl(href.replaceAll("&amp;", "&"));
    return url ? `<a href="${escapeHtml(url)}" style="color:${theme.link};text-decoration:underline">${label}</a>` : match;
  });
  html = html.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>");
  // Italic, but never Mailchimp merge tags such as *|FNAME|*.
  html = html.replace(/(^|[^*|])\*([^*\s|][^*]*?)\*(?!\|)/gu, "$1<em>$2</em>");
  return html;
}

/** Paragraphs from blank lines, lists from lines starting with "- " or "1. ". */
export function renderRichText(text: string, theme: NewsletterTheme, style: string): string {
  const blocks = text.replace(/\r\n/gu, "\n").split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^[-*]\s+/u.test(line))) {
      return `<ul style="margin:0 0 16px;padding-left:22px;${style}">${lines.map((line) => `<li style="margin:0 0 6px">${inline(line.replace(/^[-*]\s+/u, ""), theme)}</li>`).join("")}</ul>`;
    }
    if (lines.every((line) => /^\d+[.)]\s+/u.test(line))) {
      return `<ol style="margin:0 0 16px;padding-left:22px;${style}">${lines.map((line) => `<li style="margin:0 0 6px">${inline(line.replace(/^\d+[.)]\s+/u, ""), theme)}</li>`).join("")}</ol>`;
    }
    return `<p style="margin:0 0 16px;${style}">${lines.map((line) => inline(line, theme)).join("<br>")}</p>`;
  }).join("");
}

function row(content: string, padding = "0 32px"): string {
  return `<tr><td class="dnm-pad" style="padding:${padding}">${content}</td></tr>`;
}

function button(text: string, url: string, theme: NewsletterTheme, options: { background?: string | null; color?: string | null; fullWidth?: boolean; align?: string } = {}): string {
  const background = color(options.background, theme.accent);
  const foreground = color(options.color, theme.accentText);
  const width = options.fullWidth ? "width:100%;" : "";
  return `<table role="presentation" cellspacing="0" cellpadding="0" align="${options.align ?? "left"}" style="margin:0 0 16px;${width}"><tr><td style="background:${background};border-radius:${Math.min(theme.radius, 12)}px;text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;${options.fullWidth ? "width:100%;box-sizing:border-box;" : ""}padding:13px 24px;color:${foreground};font-weight:700;font-size:16px;text-decoration:none;border-radius:${Math.min(theme.radius, 12)}px">${escapeHtml(text)}</a></td></tr></table>`;
}

function columnsTable(cells: string[], perRow: number): string {
  const width = Math.floor(100 / perRow);
  const rows: string[] = [];
  for (let index = 0; index < cells.length; index += perRow) {
    const slice = cells.slice(index, index + perRow);
    while (slice.length < perRow) slice.push("");
    rows.push(`<tr>${slice.map((cell, position) => `<td class="dnm-col" width="${width}%" valign="top" style="width:${width}%;padding:0 ${position === perRow - 1 ? 0 : 12}px 16px 0">${cell}</td>`).join("")}</tr>`);
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows.join("")}</table>`;
}

function renderBlock(block: NewsletterBlock, theme: NewsletterTheme, preview: boolean): string {
  const textStyle = `color:${theme.text};font-size:16px;line-height:1.6`;
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 28 : block.level === 2 ? 22 : 18;
      return row(`<h${block.level} style="margin:0 0 12px;color:${color(block.color, theme.heading)};font-size:${size}px;line-height:1.25;text-align:${block.align}">${inline(block.text, theme)}</h${block.level}>`);
    }
    case "text":
      return row(`<div style="text-align:${block.align}">${renderRichText(block.text, theme, `color:${theme.text};font-size:${block.fontSize}px;line-height:1.6`)}</div>`);
    case "image": {
      const src = httpsOnly(block.url);
      if (!src) return preview ? row(`<div style="margin:0 0 16px;padding:40px 16px;border:2px dashed #cfc6b6;border-radius:12px;color:#8a8275;text-align:center;font-size:14px">Kies een afbeelding</div>`) : "";
      const image = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" width="${Math.round((theme.contentWidth - 64) * block.width / 100)}" style="display:inline-block;width:${block.width}%;max-width:100%;height:auto;border:0;${block.rounded ? `border-radius:${Math.min(theme.radius, 12)}px;` : ""}">`;
      const link = safeUrl(block.linkUrl);
      const caption = block.caption ? `<p style="margin:6px 0 0;color:${theme.footerText};font-size:13px;line-height:1.4">${escapeHtml(block.caption)}</p>` : "";
      return row(`<div style="margin:0 0 16px;text-align:${block.align}">${link ? `<a href="${escapeHtml(link)}">${image}</a>` : image}${caption}</div>`);
    }
    case "video": {
      const thumb = httpsOnly(block.thumbnailUrl);
      const url = safeUrl(block.videoUrl);
      if (!thumb || !url) return preview ? row(`<div style="margin:0 0 16px;padding:40px 16px;border:2px dashed #cfc6b6;border-radius:12px;color:#8a8275;text-align:center;font-size:14px">Voeg een video en miniatuur toe</div>`) : "";
      const caption = block.caption ? `<p style="margin:6px 0 0;color:${theme.footerText};font-size:13px">${escapeHtml(block.caption)}</p>` : "";
      // Email clients do not play video: a thumbnail with a play button links to the video.
      return row(`<div style="margin:0 0 16px;text-align:center"><a href="${escapeHtml(url)}"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(block.title || "Bekijk de video")}" width="${theme.contentWidth - 64}" style="display:block;width:100%;height:auto;border:0;border-radius:${Math.min(theme.radius, 12)}px"></a>${block.title ? `<p style="margin:8px 0 0;font-weight:700;color:${theme.heading}"><a href="${escapeHtml(url)}" style="color:${theme.heading};text-decoration:none">▶ ${escapeHtml(block.title)}</a></p>` : ""}${caption}</div>`);
    }
    case "button": {
      const url = safeUrl(block.url);
      return url ? row(button(block.text, url, theme, block)) : "";
    }
    case "icons": {
      const cells = block.items.map((item) => `<div style="text-align:center"><div style="font-size:32px;line-height:1.2;margin:0 0 6px">${escapeHtml(item.icon)}</div>${item.title ? `<p style="margin:0 0 4px;color:${theme.heading};font-size:15px;font-weight:700">${escapeHtml(item.title)}</p>` : ""}${item.text ? `<p style="margin:0;color:${theme.text};font-size:14px;line-height:1.5">${inline(item.text, theme)}</p>` : ""}</div>`);
      return row(columnsTable(cells, cells.length));
    }
    case "columns": {
      const cells = block.items.map((item) => {
        const image = httpsOnly(item.imageUrl);
        const link = safeUrl(item.buttonUrl);
        return `${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.heading)}" width="${Math.floor((theme.contentWidth - 64) / block.count)}" style="display:block;width:100%;height:auto;border:0;border-radius:${Math.min(theme.radius, 10)}px;margin:0 0 10px">` : ""}${item.heading ? `<p style="margin:0 0 6px;color:${theme.heading};font-size:16px;font-weight:700">${escapeHtml(item.heading)}</p>` : ""}${item.text ? renderRichText(item.text, theme, `color:${theme.text};font-size:14px;line-height:1.5;margin-bottom:10px`) : ""}${item.buttonText && link ? `<a href="${escapeHtml(link)}" style="color:${theme.link};font-weight:700;font-size:14px">${escapeHtml(item.buttonText)} →</a>` : ""}`;
      });
      return row(columnsTable(cells, block.count));
    }
    case "products": {
      if (!block.items.length) return preview ? row(`<div style="margin:0 0 16px;padding:32px 16px;border:2px dashed #cfc6b6;border-radius:12px;color:#8a8275;text-align:center;font-size:14px">Kies producten</div>`) : "";
      const cells = block.items.map((item) => {
        const image = httpsOnly(item.imageUrl);
        const url = safeUrl(item.url) ?? "https://denotenman.com";
        return `<a href="${escapeHtml(url)}" style="text-decoration:none">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" width="${Math.floor((theme.contentWidth - 64) / block.columns)}" style="display:block;width:100%;height:auto;border:0;border-radius:${Math.min(theme.radius, 10)}px;margin:0 0 8px;background:#f5f1e8">` : ""}<span style="display:block;color:${theme.heading};font-size:15px;font-weight:700;line-height:1.35">${escapeHtml(item.name)}</span>${item.priceLabel ? `<span style="display:block;margin:2px 0 8px;color:${theme.text};font-size:14px">${escapeHtml(item.priceLabel)}</span>` : ""}</a>${block.buttonText ? `<a href="${escapeHtml(url)}" style="display:inline-block;padding:8px 14px;background:${theme.accent};color:${theme.accentText};font-size:14px;font-weight:700;text-decoration:none;border-radius:${Math.min(theme.radius, 10)}px">${escapeHtml(block.buttonText)}</a>` : ""}`;
      });
      return row(columnsTable(cells, block.columns));
    }
    case "table": {
      const head = block.headers.some((header) => header.trim()) ? `<tr>${block.headers.map((header) => `<th style="padding:8px 10px;border-bottom:2px solid ${theme.accent};text-align:left;color:${theme.heading};font-size:13px;font-weight:700">${escapeHtml(header)}</th>`).join("")}</tr>` : "";
      const body = block.rows.map((cells) => `<tr>${cells.map((cell) => `<td style="padding:8px 10px;border-bottom:1px solid #e4dfd5;color:${theme.text};font-size:14px">${inline(cell, theme)}</td>`).join("")}</tr>`).join("");
      return row(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px">${head}${body}</table>`);
    }
    case "quote":
      return row(`<div style="margin:0 0 16px;padding:12px 18px;border-left:4px solid ${theme.accent};background:${theme.pageBackground};border-radius:0 ${Math.min(theme.radius, 10)}px ${Math.min(theme.radius, 10)}px 0"><p style="margin:0;${textStyle};font-style:italic">${inline(block.text, theme)}</p>${block.author ? `<p style="margin:6px 0 0;color:${theme.footerText};font-size:14px">${escapeHtml(block.author)}</p>` : ""}</div>`);
    case "divider":
      return row(`<div style="margin:8px 0 24px;border-top:${block.thickness}px solid ${color(block.color, "#e4dfd5")};font-size:0;line-height:0">&nbsp;</div>`);
    case "spacer":
      return row(`<div style="height:${block.height}px;font-size:0;line-height:0">&nbsp;</div>`);
    case "social": {
      const labels: Array<[keyof typeof block.links, string]> = [["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["website", "Website"]];
      const links = labels.map(([key, label]) => {
        const url = httpsOnly(block.links[key]);
        return url ? `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 4px 8px;padding:8px 14px;border:1px solid ${theme.accent};border-radius:999px;color:${theme.accent};font-size:14px;font-weight:700;text-decoration:none">${label}</a>` : "";
      }).join("");
      return links ? row(`<div style="margin:0 0 16px;text-align:${block.align}">${links}</div>`) : "";
    }
    case "html":
      return row(`<div style="${textStyle}">${sanitizeNewsletterContent(block.html)}</div>`);
  }
}

export type NewsletterMeta = { subject: string; previewText: string };

/** The full email. In preview mode, merge tags show sample values and empty blocks show hints. */
export function renderNewsletterEmail(document: NewsletterDocument, meta: NewsletterMeta, options: { preview?: boolean } = {}): string {
  const theme = { ...DEFAULT_NEWSLETTER_THEME, ...document.theme };
  const font = NEWSLETTER_FONTS[theme.font]?.stack ?? NEWSLETTER_FONTS.arial.stack;
  const radius = theme.radius;
  const logo = httpsOnly(theme.header.logoUrl);
  const header = theme.header.mode === "none"
    ? ""
    : `<tr><td class="dnm-pad" style="background:${theme.headerBackground};color:${theme.headerText};padding:24px 32px;text-align:${theme.header.align};font-size:26px;font-weight:700">${theme.header.mode === "logo" && logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(theme.header.text || "De Notenman")}" width="${theme.header.logoWidth}" style="display:inline-block;width:${theme.header.logoWidth}px;max-width:100%;height:auto;border:0">` : escapeHtml(theme.header.text || "De Notenman")}</td></tr>`;
  const content = document.blocks.map((block) => renderBlock(block, theme, Boolean(options.preview))).join("");
  const footerText = theme.footer.text.trim() ? renderRichText(theme.footer.text, theme, `color:${theme.footerText};font-size:12px;line-height:1.5;margin-bottom:8px`) : "";

  let html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(meta.subject)}</title>
<style>
  body { margin:0; padding:0; }
  img { -ms-interpolation-mode:bicubic; }
  a { color:${theme.link}; }
  @media only screen and (max-width: 620px) {
    .dnm-col { display:block !important; width:100% !important; padding-right:0 !important; }
    .dnm-pad { padding-left:20px !important; padding-right:20px !important; }
    .dnm-outer { padding:12px 6px !important; }
  }
</style>
</head>
<body style="margin:0;background:${theme.pageBackground};color:${theme.text};font-family:${font}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(meta.previewText)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.pageBackground}">
<tr><td class="dnm-outer" align="center" style="padding:24px 12px">
${theme.footer.showArchiveLink ? `<p style="margin:0 0 10px;font-size:12px;color:${theme.footerText};font-family:${font}"><a href="*|ARCHIVE|*" style="color:${theme.footerText}">Bekijk deze mail in je browser</a></p>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:${theme.contentWidth}px;background:${theme.contentBackground};border-radius:${radius}px;overflow:hidden;font-family:${font}">
${header}
<tr><td style="padding:32px 0 16px"><!-- DNM_CONTENT_START --><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${content}</table><!-- DNM_CONTENT_END --></td></tr>
<tr><td class="dnm-pad" style="padding:24px 32px;background:${theme.footerBackground};color:${theme.footerText};font-size:12px;line-height:1.5">
${footerText}
<p style="margin:0 0 8px">*|LIST:ADDRESS|*</p>
<p style="margin:0"><a href="*|UNSUB|*" style="color:${theme.footerText}">Afmelden voor de nieuwsbrief</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  if (options.preview) {
    for (const [tag, value] of Object.entries(NEWSLETTER_SAMPLE_VALUES)) html = html.replaceAll(tag, escapeHtml(value));
  }
  return html;
}
