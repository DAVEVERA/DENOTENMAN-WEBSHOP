import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "p",
  "h2",
  "h3",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "br",
] as const;

export function sanitizeProductHtml(value: string | null | undefined): string {
  if (!value?.trim()) return "";

  return sanitizeHtml(value, {
    allowedTags: [...allowedTags],
    allowedAttributes: { a: ["href", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => {
        const href = attributes.href?.trim();
        const isAllowedHref = Boolean(
          href && (/^(?:https?:|mailto:)/i.test(href) || href.startsWith("/"))
        );
        const attribs: Record<string, string> = isAllowedHref && href
          ? { href, rel: "noopener noreferrer" }
          : {};
        return {
          tagName: "a",
          attribs,
        };
      },
    },
  });
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };

  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const numeric = code[1]?.toLowerCase() === "x"
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
  });
}

export function toProductPlainText(value: string | null | undefined): string {
  const safe = sanitizeProductHtml(value);
  const spaced = safe.replace(/<\/(?:p|h2|h3|li|blockquote)>|<br\s*\/?>/gi, " ");
  const textOnly = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(textOnly).replace(/\s+/g, " ").trim();
}
