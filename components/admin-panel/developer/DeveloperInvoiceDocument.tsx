import { LEGAL_IDENTITY } from "@/lib/legal";
import type { DeveloperInvoiceDto, PublicDeveloperProfile } from "@/lib/developer-portal/service";
import { formatIban, lineAmountCents } from "@/lib/developer-portal/invoice-math";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const dateLabel = new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" });
const quantityLabel = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });

function money(cents: number) {
  return euro.format(cents / 100);
}

/** The invoice itself, laid out to read well on screen and to print as a PDF. */
export function DeveloperInvoiceDocument({ invoice, developer }: { invoice: DeveloperInvoiceDto; developer: PublicDeveloperProfile }) {
  const developerName = developer.businessName || developer.contactName || "Ontwikkelaar";
  return (
    <article className="rounded-panel border border-border bg-surface p-5 text-body-sm text-text shadow-card sm:p-8 print:border-0 print:p-0 print:shadow-none" aria-labelledby="invoice-heading">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-heading text-heading-md font-bold">{developerName}</p>
          <address className="mt-1 not-italic leading-6 text-muted">
            {developer.contactName && developer.businessName ? <>{developer.contactName}<br /></> : null}
            {developer.address ? <>{developer.address}<br /></> : null}
            {developer.postalCode || developer.city ? <>{developer.postalCode} {developer.city}<br /></> : null}
            {developer.email ? <>{developer.email}<br /></> : null}
            {developer.kvkNumber ? <>KvK {developer.kvkNumber}<br /></> : null}
            {developer.vatNumber ? <>Btw {developer.vatNumber}</> : null}
          </address>
        </div>
        <div className="text-right">
          <h1 id="invoice-heading" className="font-heading text-heading-lg font-bold">Factuur</h1>
          <p className="mt-1 font-semibold">{invoice.number}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Aan</h2>
          <address className="mt-1 not-italic leading-6">
            {LEGAL_IDENTITY.tradeName}<br />
            t.a.v. {LEGAL_IDENTITY.attention}<br />
            {LEGAL_IDENTITY.address}<br />
            Btw {LEGAL_IDENTITY.vatNumber}
          </address>
        </div>
        <dl className="grid content-start gap-1 sm:justify-self-end">
          <div className="flex justify-between gap-6"><dt className="text-muted">Factuurdatum</dt><dd>{dateLabel.format(new Date(invoice.issueDate))}</dd></div>
          <div className="flex justify-between gap-6"><dt className="text-muted">Vervaldatum</dt><dd>{dateLabel.format(new Date(invoice.dueDate))}</dd></div>
          <div className="flex justify-between gap-6"><dt className="text-muted">Betreft</dt><dd className="text-right">{invoice.title}</dd></div>
        </dl>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="py-2 pr-3 font-bold">Omschrijving</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Aantal</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Prijs</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Btw</th>
              <th scope="col" className="py-2 text-right font-bold">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-b border-border align-top">
                <td className="py-2 pr-3">{line.description}</td>
                <td className="py-2 pr-3 text-right">{quantityLabel.format(line.quantity)}</td>
                <td className="py-2 pr-3 text-right">{money(line.unitPriceCents)}</td>
                <td className="py-2 pr-3 text-right">{line.vatRate}%</td>
                <td className="py-2 text-right">{money(lineAmountCents(line))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-4 grid max-w-xs gap-1">
        <div className="flex justify-between gap-6"><dt className="text-muted">Subtotaal</dt><dd>{money(invoice.subtotalCents)}</dd></div>
        {invoice.vatByRate.map((row) => <div key={row.rate} className="flex justify-between gap-6"><dt className="text-muted">Btw {row.rate}% over {money(row.baseCents)}</dt><dd>{money(row.vatCents)}</dd></div>)}
        <div className="flex justify-between gap-6 border-t border-border pt-1 font-heading text-body-md font-bold"><dt>Totaal</dt><dd>{money(invoice.totalCents)}</dd></div>
      </dl>

      {invoice.notes ? <p className="mt-6 whitespace-pre-wrap leading-6">{invoice.notes}</p> : null}

      <footer className="mt-6 border-t border-border pt-4 leading-6 text-muted">
        {developer.payment.bankTransfer ? (
          <p>Graag {money(invoice.totalCents)} vóór {dateLabel.format(new Date(invoice.dueDate))} overmaken naar {formatIban(developer.payment.bankTransfer.iban)}{developer.bic ? ` (BIC ${developer.bic})` : ""} t.n.v. {developer.payment.bankTransfer.accountHolder}, onder vermelding van {invoice.number}.</p>
        ) : (
          <p>Graag {money(invoice.totalCents)} vóór {dateLabel.format(new Date(invoice.dueDate))} betalen, onder vermelding van {invoice.number}.</p>
        )}
      </footer>
    </article>
  );
}
