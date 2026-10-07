"use client";

import { Check, Copy, Landmark, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { epcQrPayload, groupIban, normalizeIban, paymentReference, plainAmount } from "@/lib/developer-portal/bank-transfer";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function CopyRow({ label, shown, copy }: { label: string; shown: string; copy: string }) {
  const [copied, setCopied] = useState(false);
  async function run() {
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access (older browser, no https): the value stays visible to select.
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1 last:border-0">
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="break-words font-semibold text-text">{shown}</dd>
      </div>
      <button
        type="button"
        onClick={() => void run()}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-button border border-border bg-surface px-3 font-heading text-xs font-bold text-text hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`${label} kopiëren`}
      >
        {copied ? <Check className="h-4 w-4 text-green-700" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Gekopieerd" : "Kopieer"}</span>
      </button>
    </div>
  );
}

/**
 * Pays straight to the developer's bank account: a QR code that a bank app scans (account,
 * amount and invoice numbers come filled in) and the same details to copy. No payment
 * provider in between, so the money is available as soon as the bank books it.
 */
export function BankPaymentCard({ iban, accountHolder, amountCents, invoiceNumbers }: { iban: string; accountHolder: string; amountCents: number; invoiceNumbers: string[] }) {
  const reference = paymentReference(invoiceNumbers);
  const payload = epcQrPayload({ name: accountHolder, iban, amountCents, reference });
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = target.current;
    if (!node || !payload) return;
    let cancelled = false;
    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled) return;
      node.replaceChildren();
      new QRCodeStyling({
        width: 208,
        height: 208,
        type: "svg",
        data: payload,
        margin: 0,
        qrOptions: { errorCorrectionLevel: "M" },
        dotsOptions: { color: "#000000", type: "square" },
        backgroundOptions: { color: "#ffffff" },
      }).append(node);
    });
    return () => {
      cancelled = true;
      node.replaceChildren();
    };
  }, [payload]);

  if (amountCents <= 0) return null;
  return (
    <section className="grid gap-4 rounded-card border border-border bg-background p-4 sm:grid-cols-[auto_minmax(0,1fr)]" aria-label="Betalen met je bank">
      {payload ? (
        <div className="grid justify-items-center gap-2">
          <div ref={target} className="rounded-card bg-white p-3" role="img" aria-label={`QR-code om ${euro.format(amountCents / 100)} te betalen`} />
          <p className="flex items-center gap-1 text-xs text-muted"><QrCode className="h-3.5 w-3.5" aria-hidden="true" />Scan met je bank-app</p>
        </div>
      ) : null}
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-heading text-body-md font-bold text-text"><Landmark className="h-4 w-4" aria-hidden="true" />Betaal direct met je bank</h3>
        <p className="mt-1 text-body-sm text-muted">
          {payload
            ? "Scan de QR-code in je bank-app: rekening, bedrag en factuurnummer staan dan al ingevuld. Of kopieer de gegevens hieronder. Het geld gaat rechtstreeks naar de rekening, zonder tussenpartij."
            : "Maak het bedrag over naar de rekening hieronder. Het geld gaat rechtstreeks naar de rekening, zonder tussenpartij."}
        </p>
        <dl className="mt-2 text-body-sm">
          <CopyRow label="Bedrag" shown={euro.format(amountCents / 100)} copy={plainAmount(amountCents)} />
          <CopyRow label="IBAN" shown={groupIban(iban)} copy={normalizeIban(iban)} />
          <CopyRow label="Op naam van" shown={accountHolder} copy={accountHolder} />
          <CopyRow label="Omschrijving" shown={reference} copy={reference} />
        </dl>
        <p className="mt-2 text-xs text-muted">Zet de omschrijving er precies zo in, dan weet de ontwikkelaar welke factuur het is. De factuur gaat op betaald zodra de overboeking is gezien.</p>
      </div>
    </section>
  );
}
