import type { BusinessAccount, Order, OrderItem } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { BASE_URL, orderConfirmation } from "@/lib/routes";
import { postnlTrackingUrl } from "@/lib/shipping";
import type {
  AftersalesCanvas,
  AftersalesDesign,
  AftersalesLegacyLocaleContent,
  AftersalesTriggerValue,
} from "@/lib/aftersales/schema";
import { blockTextKey, defaultAftersalesDesign } from "@/lib/aftersales/schema";
import { renderAftersalesCanvas } from "@/lib/aftersales/canvas-renderer";

const FONT_STACKS: Record<AftersalesDesign["font"], string> = {
  SANS: "Arial,Helvetica,sans-serif",
  SERIF: "Georgia,'Times New Roman',serif",
  MODERN: "'Segoe UI',Verdana,sans-serif",
};

type OrderWithItems = Order & {
  items: OrderItem[];
  businessOrderList?: { businessAccount: BusinessAccount | null } | null;
};

export type RenderedFlowEmail = {
  subject: string;
  html: string;
  text: string;
  actionUrl: string;
};

export type RenderedAftersalesEmail = RenderedFlowEmail;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function actionUrlFor(order: Order, trigger: AftersalesTriggerValue, locale: Locale): string {
  if (
    (trigger === "ORDER_FULFILLED" || trigger === "BUSINESS_ORDER_FULFILLED") &&
    order.postnlTrackingCode &&
    order.shippingPostalCode
  ) {
    return postnlTrackingUrl(
      order.postnlTrackingCode,
      order.shippingPostalCode,
      order.shippingCountry
    );
  }
  return `${BASE_URL}${orderConfirmation(locale, order.id)}`;
}

export function replaceTokens(value: string, values: Record<string, string>): string {
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, token: string) => values[token] ?? "");
}

/**
 * Same substitution as replaceTokens, but with every token VALUE HTML-escaped
 * first. customHtml blocks render their resolved blockText unescaped (that's
 * how an admin embeds real HTML), so a token substituted into one must have
 * its (customer-controlled) value escaped here - the admin's own HTML around
 * it stays real markup, only the substituted value is neutralized.
 */
function replaceTokensEscaped(value: string, values: Record<string, string>): string {
  return replaceTokens(value, Object.fromEntries(Object.entries(values).map(([key, val]) => [key, escapeHtml(val)])));
}

/** Ids (as blockText keys) of every customHtml block in the canvas - the only
 * block type whose resolved text reaches the email unescaped, so it's the
 * only one that needs its token values escaped before substitution. */
function customHtmlBlockTextKeys(canvas: AftersalesCanvas): string[] {
  const keys: string[] = [];
  for (const row of canvas.rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if (block.type === "customHtml") keys.push(blockTextKey(block.id));
      }
    }
  }
  return keys;
}

/** Re-derives resolvedBlockText's entries for customHtml blocks using
 * escaped token values, mutating the given resolvedBlockText in place from
 * the original (pre-substitution) blockText. Ordinary blocks are left as
 * whatever replaceTokens already produced - they're escaped downstream by
 * the canvas renderer, so escaping here too would double-escape them. */
function escapeCustomHtmlTokens(
  canvas: AftersalesCanvas,
  blockText: Record<string, string>,
  resolvedBlockText: Record<string, string>,
  tokens: Record<string, string>
): void {
  for (const key of customHtmlBlockTextKeys(canvas)) {
    if (key in blockText) resolvedBlockText[key] = replaceTokensEscaped(blockText[key], tokens);
  }
}

/**
 * Shared shell for every mail-flow email regardless of trigger: brand/logo,
 * heading+body in the chosen layout (including grid/table blocks), and the
 * call-to-action button. Order-specific extras (bestelnummer box, item
 * table, tracking line) are the caller's job - see renderAftersalesEmail.
 */
function renderEmailShell(input: {
  locale: Locale;
  subject: string;
  previewText: string;
  canvas: AftersalesCanvas;
  blockText: Record<string, string>;
  actionUrl: string;
  design: AftersalesDesign;
  logoUrl: string | null;
  extraHtml?: string;
  extraText?: string[];
  footerText: string;
}): RenderedFlowEmail {
  const { locale, subject, previewText, canvas, blockText, actionUrl, design, logoUrl, extraHtml, extraText, footerText } = input;
  const fontStack = FONT_STACKS[design.font];
  const brandBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="De Notenman" style="display:block;height:32px;width:auto;margin:0 0 12px" />`
    : `<p style="margin:0;color:#806600;font-size:13px;font-weight:700;letter-spacing:.08em">DE NOTENMAN</p>`;
  const contentBlock = renderAftersalesCanvas(canvas, {
    escapeText: escapeHtml,
    resolveText: (key) => blockText[key] ?? "",
    defaultActionUrl: actionUrl,
  });

  const html = `<!doctype html>
<html lang="${locale}" dir="ltr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f6f3ee;font-family:${fontStack}">
  <div lang="${locale}" dir="ltr" style="display:none;max-height:0;overflow:hidden">${escapeHtml(previewText)}</div>
  <div lang="${locale}" dir="ltr" style="padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;overflow:hidden;border:1px solid #ded7ca;border-radius:12px;background:#fff">
      <div style="height:5px;background:#e0b200"></div>
      <div style="padding:28px">
        ${brandBlock}
        ${contentBlock}
        ${extraHtml ?? ""}
      </div>
      <div style="padding:18px 28px 24px;border-top:1px solid #ded7ca;color:#6e675c;font-size:13px;line-height:1.5">${escapeHtml(footerText)}</div>
    </div>
  </div>
</body>
</html>`;

  const heading = blockText[blockTextKey("heading")] ?? "";
  const body = blockText[blockTextKey("body")] ?? "";
  const buttonLabel = blockText[blockTextKey("button")] ?? "";
  const text = [
    heading,
    "",
    body,
    ...(extraText && extraText.length > 0 ? ["", ...extraText] : []),
    "",
    `${buttonLabel}: ${actionUrl}`,
    "",
    footerText,
  ].join("\n");

  return { subject, html, text, actionUrl };
}

export function renderAftersalesEmail(
  order: OrderWithItems,
  trigger: AftersalesTriggerValue,
  content: AftersalesLegacyLocaleContent,
  canvas: AftersalesCanvas,
  blockText: Record<string, string>,
  design: AftersalesDesign = defaultAftersalesDesign,
  logoUrl: string | null = null
): RenderedFlowEmail {
  const locale: Locale = isLocale(order.locale) ? order.locale : "nl";
  const actionUrl = actionUrlFor(order, trigger, locale);
  const tokens = {
    first_name: firstName(order.contactName),
    customer_name: order.contactName,
    order_number: order.id,
    order_total: formatPrice(order.totalCents, locale),
    tracking_code: order.postnlTrackingCode ?? "",
    order_url: actionUrl,
    business_name: order.businessOrderList?.businessAccount?.companyName ?? "",
    contact_name: order.businessOrderList?.businessAccount?.contactName ?? order.contactName,
  };
  const subject = replaceTokens(content.subject, tokens);
  const preview = replaceTokens(content.previewText, tokens);
  const resolvedBlockText = Object.fromEntries(
    Object.entries(blockText).map(([key, value]) => [key, replaceTokens(value, tokens)])
  );
  escapeCustomHtmlTokens(canvas, blockText, resolvedBlockText, tokens);
  const itemRows = order.items.map((item) => `
    <tr>
      <td style="padding:10px 8px 10px 0;border-bottom:1px solid #e4dfd5;color:#333;font-size:14px;line-height:1.45">
        <strong>${item.quantity}&times; ${escapeHtml(item.productName)}</strong><br>
        <span style="color:#6e675c;font-size:13px">${escapeHtml(item.variantLabel)}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e4dfd5;color:#333;font-size:14px;text-align:right;white-space:nowrap">
        ${escapeHtml(formatPrice(item.unitPriceCents * item.quantity, locale))}
      </td>
    </tr>`).join("");
  const itemsSection = trigger === "ORDER_PAID" ? `
    <h2 style="margin:24px 0 10px;color:#141414;font-size:18px;line-height:1.35">${locale === "fr" ? "Votre commande" : locale === "en" ? "Your order" : "Je bestelling"}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse" aria-label="Order items">
      <tbody>${itemRows}</tbody>
      <tfoot><tr><td style="padding-top:12px;color:#141414;font-weight:700">Totaal</td><td style="padding-top:12px;color:#141414;font-weight:700;text-align:right">${escapeHtml(formatPrice(order.totalCents, locale))}</td></tr></tfoot>
    </table>` : "";
  const tracking = (trigger === "ORDER_FULFILLED" || trigger === "BUSINESS_ORDER_FULFILLED") && order.postnlTrackingCode
    ? `<p style="margin:18px 0 0;color:#333;font-size:14px"><strong>Track &amp; trace:</strong> ${escapeHtml(order.postnlTrackingCode)}</p>`
    : "";
  const orderNumberBox = `<div style="margin:18px 0;padding:14px 16px;border:1px solid #ded7ca;border-radius:8px;background:#f6f3ee;color:#333;font-size:14px"><strong>Bestelnummer:</strong> ${escapeHtml(order.id)}</div>`;

  return renderEmailShell({
    locale,
    subject,
    previewText: preview,
    canvas,
    blockText: resolvedBlockText,
    actionUrl,
    design,
    logoUrl,
    extraHtml: `${orderNumberBox}${itemsSection}${tracking}`,
    extraText: [
      `Bestelnummer: ${order.id}`,
      ...(trigger === "ORDER_PAID"
        ? [
            ...order.items.map((item) => `${item.quantity}× ${item.productName} (${item.variantLabel}) — ${formatPrice(item.unitPriceCents * item.quantity, locale)}`),
            `Totaal: ${formatPrice(order.totalCents, locale)}`,
          ]
        : []),
      ...(order.postnlTrackingCode ? [`Track & trace: ${order.postnlTrackingCode}`] : []),
    ],
    footerText: "Vragen? Beantwoord deze e-mail; we helpen je graag.",
  });
}

const GENERIC_FOOTER: Record<Locale, string> = {
  nl: "Vragen? Beantwoord deze e-mail; we helpen je graag.",
  en: "Questions? Reply to this email and we'll help you out.",
  fr: "Des questions ? Répondez à cet e-mail, nous serons ravis de vous aider.",
};

/**
 * Renders a mail-flow step for triggers that have no Order to draw context
 * from (back-in-stock, business invitations, admin notifications, etc).
 * Same shell/design system as renderAftersalesEmail, generic token map
 * instead of order fields.
 */
export function renderGenericFlowEmail(input: {
  locale: Locale;
  content: AftersalesLegacyLocaleContent;
  canvas: AftersalesCanvas;
  blockText: Record<string, string>;
  design?: AftersalesDesign;
  logoUrl?: string | null;
  tokens: Record<string, string>;
  actionUrl: string;
}): RenderedFlowEmail {
  const { locale, content, canvas, blockText, design = defaultAftersalesDesign, logoUrl = null, tokens, actionUrl } = input;
  const subject = replaceTokens(content.subject, tokens);
  const preview = replaceTokens(content.previewText, tokens);
  const resolvedBlockText = Object.fromEntries(
    Object.entries(blockText).map(([key, value]) => [key, replaceTokens(value, tokens)])
  );
  escapeCustomHtmlTokens(canvas, blockText, resolvedBlockText, tokens);

  return renderEmailShell({
    locale,
    subject,
    previewText: preview,
    canvas,
    blockText: resolvedBlockText,
    actionUrl,
    design,
    logoUrl,
    footerText: GENERIC_FOOTER[locale] ?? GENERIC_FOOTER.nl,
  });
}
