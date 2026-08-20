import sanitizeHtml from "sanitize-html";

const fullDescriptionTags = [
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
  "span",
  "br",
] as const;

const shortDescriptionTags = ["p", "strong", "em", "span", "br"] as const;

const richTextFonts = new Set(["body", "heading"]);
const richTextSizes = new Set(["sm", "md", "lg"]);

const legacyProductCopyPatterns = [
  "van De Notenman valt binnen",
  "Op de productpagina staan de beschikbare gewichten",
  "puur genieten met karakter",
  "Zin in iets dat meteen goed smaakt",
  "Een product dat uitnodigt om te proeven",
  "Bestel eenvoudig bij De Notenman",
] as const;

function sanitizeRichText(
  value: string | null | undefined,
  allowedTags: readonly string[]
): string {
  if (!value?.trim()) return "";

  const sanitized = sanitizeHtml(value, {
    allowedTags: [...allowedTags],
    allowedAttributes: {
      a: ["href", "rel"],
      span: ["data-rt-font", "data-rt-size"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      b: "strong",
      i: "em",
      div: "p",
      span: (_tagName, attributes) => {
        const font = attributes["data-rt-font"]?.trim().toLowerCase();
        const size = attributes["data-rt-size"]?.trim().toLowerCase();
        const attribs: Record<string, string> = {};
        if (font && richTextFonts.has(font)) attribs["data-rt-font"] = font;
        if (size && richTextSizes.has(size)) attribs["data-rt-size"] = size;
        return { tagName: "span", attribs };
      },
      a: (_tagName, attributes) => {
        const href = attributes.href?.trim();
        const isAllowedHref = Boolean(
          href && (/^(?:https?:|mailto:)/i.test(href) || /^\/(?!\/)/.test(href))
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
  const visibleText = sanitizeHtml(sanitized, { allowedTags: [], allowedAttributes: {} })
    .replace(/(?:&nbsp;|&#160;|&#xa0;|\s)+/gi, "");
  return visibleText ? sanitized : "";
}

export function sanitizeProductHtml(value: string | null | undefined): string {
  return sanitizeRichText(value, fullDescriptionTags);
}

export function sanitizeProductShortHtml(value: string | null | undefined): string {
  return sanitizeRichText(value, shortDescriptionTags);
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
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 0x10ffff
      ? String.fromCodePoint(numeric)
      : entity;
  });
}

export function toProductPlainText(value: string | null | undefined): string {
  const safe = sanitizeProductHtml(value);
  const spaced = safe.replace(
    /<\/?(?:p|h2|h3|ul|ol|li|blockquote)\b[^>]*>|<br\s*\/?>/gi,
    " "
  );
  const textOnly = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(textOnly).replace(/\s+/g, " ").trim();
}

export function hasLegacyProductCopy(value: string | null | undefined): boolean {
  return Boolean(value && legacyProductCopyPatterns.some((pattern) => value.includes(pattern)));
}

export function shouldPreserveImprovedProductCopy(
  currentValue: string | null | undefined,
  incomingValue: string | null | undefined,
): boolean {
  return Boolean(
    currentValue?.trim()
    && !hasLegacyProductCopy(currentValue)
    && hasLegacyProductCopy(incomingValue),
  );
}
