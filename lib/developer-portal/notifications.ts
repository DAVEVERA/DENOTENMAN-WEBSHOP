import { formatPrice } from "@/lib/format";
import { formatIban } from "./invoice-math";

export type DeveloperInvoiceNoticeKind = "READY" | "FIRST_REMINDER" | "SECOND_REMINDER";

export type DeveloperInvoiceNoticeInput = {
  kind: DeveloperInvoiceNoticeKind;
  invoice: { number: string; title: string; totalCents: number; issueDate: Date; dueDate: Date };
  developerName: string;
  invoiceUrl: string;
  payment: { stripe: boolean; bankTransfer: { iban: string; accountHolder: string } | null; link: { url: string; label: string } | null };
};

const dateFormat = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

const copy: Record<DeveloperInvoiceNoticeKind, { subject: (number: string, from: string) => string; intro: string }> = {
  READY: {
    subject: (number, from) => `Nieuwe factuur ${number} van ${from} staat klaar`,
    intro: "Er staat een nieuwe factuur voor je klaar in het beheerportaal.",
  },
  FIRST_REMINDER: {
    subject: (number) => `Herinnering: factuur ${number} staat nog open`,
    intro: "Een vriendelijke herinnering: deze factuur staat nog open. Misschien is hij door de drukte even blijven liggen.",
  },
  SECOND_REMINDER: {
    subject: (number) => `Tweede herinnering: factuur ${number} staat nog open`,
    intro: "Dit is de tweede herinnering voor deze factuur. Wil je hem zo snel mogelijk betalen? Klopt er iets niet, laat het dan even weten.",
  },
};

export function buildDeveloperInvoiceNotice(input: DeveloperInvoiceNoticeInput): { subject: string; html: string; text: string } {
  const { invoice } = input;
  const total = formatPrice(invoice.totalCents, "nl");
  const due = dateFormat.format(invoice.dueDate);
  const from = input.developerName || "de ontwikkelaar";
  const texts = copy[input.kind];
  const subject = texts.subject(invoice.number, from);

  const payLines: string[] = [];
  if (input.payment.stripe) payLines.push("Betaal direct online (iDEAL, kaart) via de knop in het beheerportaal.");
  if (input.payment.bankTransfer) {
    payLines.push(`Of maak ${total} over naar ${formatIban(input.payment.bankTransfer.iban)} t.n.v. ${input.payment.bankTransfer.accountHolder}, onder vermelding van ${invoice.number}.`);
  }
  if (input.payment.link) payLines.push(`${input.payment.link.label || "Betaallink"}: ${input.payment.link.url}`);

  const text = [
    texts.intro,
    "",
    `Factuur: ${invoice.number}`,
    `Omschrijving: ${invoice.title}`,
    `Bedrag: ${total}`,
    `Uiterlijk betalen op: ${due}`,
    "",
    ...payLines,
    "",
    `Bekijk de factuur: ${input.invoiceUrl}`,
    "",
    `Met vriendelijke groet,`,
    from,
  ].join("\n");

  const row = (label: string, value: string) => `<tr><td style="padding:4px 12px 4px 0;color:#6b6258">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600;color:#2b2621">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#2b2621">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border:1px solid #e6dfd4;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:16px;line-height:24px">${escapeHtml(texts.intro)}</p>
<table style="border-collapse:collapse;font-size:15px;line-height:22px">${row("Factuur", invoice.number)}${row("Omschrijving", invoice.title)}${row("Bedrag", total)}${row("Uiterlijk betalen op", due)}</table>
${payLines.map((line) => `<p style="margin:16px 0 0;font-size:15px;line-height:22px">${escapeHtml(line)}</p>`).join("")}
<p style="margin:24px 0 0"><a href="${escapeHtml(input.invoiceUrl)}" style="display:inline-block;background:#2b2621;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">Factuur bekijken en betalen</a></p>
<p style="margin:24px 0 0;font-size:15px;line-height:22px">Met vriendelijke groet,<br>${escapeHtml(from)}</p>
</div></div></body></html>`;

  return { subject, html, text };
}
