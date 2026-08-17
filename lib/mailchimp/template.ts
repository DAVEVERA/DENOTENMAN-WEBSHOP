import sanitizeHtml from "sanitize-html";
import type { NewsletterDraftInput } from "@/lib/mailchimp/newsletter";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sanitizeNewsletterContent(contentHtml: string): string {
  return sanitizeHtml(contentHtml, {
    allowedTags: [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "strong",
      "b",
      "em",
      "i",
      "a",
      "br",
      "blockquote",
      "hr",
    ],
    allowedAttributes: { a: ["href", "title", "target"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}

export function buildNewsletterHtml(input: NewsletterDraftInput): string {
  const content = sanitizeNewsletterContent(input.contentHtml);
  return `<!doctype html>
<html lang="nl">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head>
  <body style="margin:0;background:#f5f1e8;color:#24231f;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden">
          <tr><td style="background:#596b2b;color:#ffffff;padding:24px 32px;font-size:26px;font-weight:700">De Notenman</td></tr>
          <tr><td style="padding:32px;font-size:16px;line-height:1.65"><!-- DNM_CONTENT_START -->${content}<!-- DNM_CONTENT_END --></td></tr>
          <tr><td style="padding:24px 32px;background:#eee8db;color:#5d5a52;font-size:12px;line-height:1.5">
            <p style="margin:0 0 8px">*|LIST:ADDRESS|*</p>
            <p style="margin:0"><a href="*|UNSUB|*" style="color:#596b2b">Afmelden voor de nieuwsbrief</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function extractNewsletterContent(html: string): string {
  const startMarker = "<!-- DNM_CONTENT_START -->";
  const endMarker = "<!-- DNM_CONTENT_END -->";
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return html;
  return html.slice(start + startMarker.length, end).trim();
}
