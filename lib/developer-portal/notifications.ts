import { formatPrice } from "@/lib/format";
import { formatIban } from "./invoice-math";

export type DeveloperInvoiceNoticeKind = "READY" | "FIRST_REMINDER" | "SECOND_REMINDER";

export type NoticeInvoice = { number: string; title: string; subtotalCents: number; vatCents: number; totalCents: number; issueDate: Date; dueDate: Date };

export type DeveloperInvoiceNoticeInput = {
  kind: DeveloperInvoiceNoticeKind;
  /** One or more invoices; several are listed with one combined total. */
  invoices: NoticeInvoice[];
  developerName: string;
  invoiceUrl: string;
  payment: { stripe: boolean; bankTransfer: { iban: string; accountHolder: string } | null; link: { url: string; label: string } | null };
};

const dateFormat = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function subject(kind: DeveloperInvoiceNoticeKind, invoices: NoticeInvoice[], from: string): string {
  const single = invoices.length === 1;
  const what = single ? `factuur ${invoices[0].number}` : `${invoices.length} facturen`;
  if (kind === "READY") return single ? `Nieuwe factuur ${invoices[0].number} van ${from} staat klaar` : `${invoices.length} nieuwe facturen van ${from} staan klaar`;
  if (kind === "FIRST_REMINDER") return `Herinnering: ${what} ${single ? "staat" : "staan"} nog open`;
  return `Tweede herinnering: ${what} ${single ? "staat" : "staan"} nog open`;
}

function intro(kind: DeveloperInvoiceNoticeKind, single: boolean): string {
  if (kind === "READY") return single ? "Er staat een nieuwe factuur voor je klaar in het beheerportaal." : "Er staan nieuwe facturen voor je klaar in het beheerportaal.";
  if (kind === "FIRST_REMINDER") return `Een vriendelijke herinnering: ${single ? "deze factuur staat" : "deze facturen staan"} nog open. Misschien is het door de drukte even blijven liggen.`;
  return `Dit is de tweede herinnering. Wil je ${single ? "de factuur" : "de facturen"} zo snel mogelijk betalen? Klopt er iets niet, laat het dan even weten.`;
}

export function buildDeveloperInvoiceNotice(input: DeveloperInvoiceNoticeInput): { subject: string; html: string; text: string } {
  const { invoices } = input;
  const single = invoices.length === 1;
  const from = input.developerName || "de ontwikkelaar";
  const sum = (key: "subtotalCents" | "vatCents" | "totalCents") => invoices.reduce((total, invoice) => total + invoice[key], 0);
  const totals = { subtotal: formatPrice(sum("subtotalCents"), "nl"), vat: formatPrice(sum("vatCents"), "nl"), total: formatPrice(sum("totalCents"), "nl") };
  const due = dateFormat.format(new Date(Math.min(...invoices.map((invoice) => invoice.dueDate.getTime()))));
  const references = invoices.map((invoice) => invoice.number).join(", ");

  const payLines: string[] = [];
  if (input.payment.stripe) payLines.push(`Betaal direct online (iDEAL, kaart) via de knop in het beheerportaal${single ? "" : "; één betaling voor alle facturen"}.`);
  if (input.payment.bankTransfer) payLines.push(`Betaal direct met je bank-app: open ${single ? "de factuur" : "de facturen"} in het beheerportaal en scan de QR-code, of maak ${totals.total} over naar ${formatIban(input.payment.bankTransfer.iban)} t.n.v. ${input.payment.bankTransfer.accountHolder}, onder vermelding van ${references}.`);
  if (input.payment.link) payLines.push(`${input.payment.link.label || "Betaallink"}: ${input.payment.link.url}`);

  const invoiceText = invoices.map((invoice) => `- ${invoice.number}: ${invoice.title} (${formatPrice(invoice.totalCents, "nl")})`);
  const text = [
    intro(input.kind, single),
    "",
    ...invoiceText,
    "",
    `Subtotaal: ${totals.subtotal}`,
    `Btw: ${totals.vat}`,
    `Totaal: ${totals.total}`,
    `Uiterlijk betalen op: ${due}`,
    "",
    ...payLines,
    "",
    `Bekijk ${single ? "de factuur" : "de facturen"}: ${input.invoiceUrl}`,
    "",
    "Met vriendelijke groet,",
    from,
  ].join("\n");

  const row = (label: string, value: string, bold = false) => `<tr><td style="padding:3px 12px 3px 0;color:#6b6258">${escapeHtml(label)}</td><td style="padding:3px 0;text-align:right;${bold ? "font-weight:700;" : ""}color:#2b2621">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#2b2621">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border:1px solid #e6dfd4;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:16px;line-height:24px">${escapeHtml(intro(input.kind, single))}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:20px;margin:0 0 12px">${invoices.map((invoice) => `<tr><td style="padding:4px 12px 4px 0;border-bottom:1px solid #eee7dc"><strong>${escapeHtml(invoice.number)}</strong><br><span style="color:#6b6258">${escapeHtml(invoice.title)}</span></td><td style="padding:4px 0;border-bottom:1px solid #eee7dc;text-align:right;white-space:nowrap">${escapeHtml(formatPrice(invoice.totalCents, "nl"))}</td></tr>`).join("")}</table>
<table style="margin-left:auto;border-collapse:collapse;font-size:15px;line-height:22px">${row("Subtotaal", totals.subtotal)}${row("Btw", totals.vat)}${row("Totaal", totals.total, true)}${row("Uiterlijk betalen op", due)}</table>
${payLines.map((line) => `<p style="margin:16px 0 0;font-size:15px;line-height:22px">${escapeHtml(line)}</p>`).join("")}
<p style="margin:24px 0 0"><a href="${escapeHtml(input.invoiceUrl)}" style="display:inline-block;background:#2b2621;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${single ? "Factuur bekijken en betalen" : "Facturen bekijken en betalen"}</a></p>
<p style="margin:24px 0 0;font-size:15px;line-height:22px">Met vriendelijke groet,<br>${escapeHtml(from)}</p>
</div></div></body></html>`;

  return { subject: subject(input.kind, invoices, from), html, text };
}
