import {
  countReviewWorklistOutsideWindow,
  loadReviewAnalysis,
  loadReviewWorklist,
} from "@/lib/review-requests-db";
import { REVIEW_WORKLIST_MIN_AGE_DAYS, REVIEW_WORKLIST_WINDOW_DAYS } from "@/lib/review-requests";
import { ReviewRequestButton } from "../../bestellingen/ReviewRequestButton";
import { MeasureRatingButton } from "./MeasureRatingButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(value);
}

function formatWeek(weekStart: string): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short" }).format(
    new Date(`${weekStart}T00:00:00Z`)
  );
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default async function ReviewRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const now = new Date();
  const includeOlder = (await searchParams).periode === "alles";
  const [worklist, analysis, outsideWindow] = await Promise.all([
    loadReviewWorklist(now, { includeOlder }),
    loadReviewAnalysis(now),
    countReviewWorklistOutsideWindow(now),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-heading text-heading-lg font-semibold text-text">Reviewverzoeken</h1>
      <p className="mt-1 text-body-sm text-muted">
        Eén mail per bestelling, met de hand verstuurd nadat het pakket bezorgd is. Iedere klant
        krijgt dezelfde uitnodiging naar hetzelfde Google-formulier.
      </p>

      <section className="mt-6 rounded-panel border border-border bg-surface p-5">
        <h2 className="font-heading text-heading-sm font-semibold text-text">Te versturen</h2>
        <p className="mt-1 text-body-sm text-muted">
          Bestellingen die minstens {REVIEW_WORKLIST_MIN_AGE_DAYS} dagen onderweg zijn en nog geen
          verzoek hebben gehad, oudste eerst.
        </p>

        {worklist.entries.length === 0 ? (
          <p className="mt-4 text-body-sm text-muted">
            Niets te versturen. Dat kan ook betekenen dat er nog geen Google-reviewlink is
            ingesteld — dat staat bij Instellingen.
          </p>
        ) : (
          <table className="mt-4 w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-3 font-normal">Klant</th>
                <th className="py-2 pr-3 font-normal">Bestelling</th>
                <th className="py-2 pr-3 font-normal">Verwerkt</th>
                <th className="py-2 font-normal">Actie</th>
              </tr>
            </thead>
            <tbody>
              {worklist.entries.map((entry) => (
                <tr key={entry.orderId} className="border-b border-border align-top">
                  <td className="py-3 pr-3 text-text">
                    {entry.contactName}
                    <span className="block text-muted">{entry.contactEmail}</span>
                  </td>
                  <td className="py-3 pr-3 text-text">
                    {entry.orderNumber}
                    <span className="block text-muted">
                      {entry.deliveryMethod === "PICKUP" ? "Afhalen" : "Verzending"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-text">{formatDate(entry.deliveredAt)}</td>
                  <td className="py-3">
                    <ReviewRequestButton
                      orderId={entry.orderId}
                      blockedReason={null}
                      warnings={entry.warnings}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {worklist.withWarnings > 0 ? (
          <p className="mt-4 text-body-sm text-muted">
            {worklist.withWarnings} bestelling(en) blijven hier buiten omdat er een terugbetaling,
            annulering of annuleringsverzoek op staat. Wil je zo iemand toch vragen, doe dat dan
            vanaf de bestelling zelf.
          </p>
        ) : null}

        {includeOlder ? (
          <p className="mt-4 text-body-sm text-muted">
            Je kijkt nu ook naar bestellingen ouder dan {REVIEW_WORKLIST_WINDOW_DAYS} dagen, oudste
            eerst. Stuur ze met beleid: iedereen die je nu vraagt, kun je een half jaar niet
            opnieuw vragen.{" "}
            <Link href="/admin/marketing/reviews" className="text-accent-hover underline underline-offset-4">
              Terug naar de laatste {REVIEW_WORKLIST_WINDOW_DAYS} dagen
            </Link>
          </p>
        ) : outsideWindow > 0 ? (
          <p className="mt-4 text-body-sm text-muted">
            {outsideWindow} bestelling(en) komen wel in aanmerking maar zijn ouder dan{" "}
            {REVIEW_WORKLIST_WINDOW_DAYS} dagen. Ze in één keer wegsturen verbruikt de
            zesmaandengrens voor een groot deel van je klanten op dezelfde dag.{" "}
            <Link href="/admin/marketing/reviews?periode=alles" className="text-accent-hover underline underline-offset-4">
              Laat ze toch zien
            </Link>
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-panel border border-border bg-surface p-5">
        <h2 className="font-heading text-heading-sm font-semibold text-text">Analyse</h2>

        {analysis.latest ? (
          <p className="mt-2 text-body-sm text-text">
            Huidige beoordeling:{" "}
            <strong>{analysis.latest.rating.toFixed(1)}</strong> uit {analysis.latest.reviewCount}{" "}
            reviews.
          </p>
        ) : (
          <p className="mt-2 text-body-sm text-muted">
            Nog geen metingen. De dagelijkse taak vult dit, of meet nu zelf.
          </p>
        )}
        <MeasureRatingButton />

        {analysis.weeks.length === 0 ? (
          <p className="mt-4 text-body-sm text-muted">Nog niets te vergelijken.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-3 font-normal">Week vanaf</th>
                <th className="py-2 pr-3 font-normal">Verstuurd</th>
                <th className="py-2 pr-3 font-normal">Nieuwe reviews</th>
                <th className="py-2 font-normal">Verhouding</th>
              </tr>
            </thead>
            <tbody>
              {analysis.weeks.map((week) => (
                <tr key={week.weekStart} className="border-b border-border">
                  <td className="py-2 pr-3 text-text">{formatWeek(week.weekStart)}</td>
                  <td className="py-2 pr-3 text-text">{week.sent}</td>
                  <td className="py-2 pr-3 text-text">{week.newReviews}</td>
                  <td className="py-2 text-text">{formatRate(week.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {analysis.ratingSeries.length > 1 ? (
          <div className="mt-6">
            <h3 className="text-body-sm font-semibold text-text">Beoordeling over tijd</h3>
            <table className="mt-2 w-full border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3 font-normal">Gemeten op</th>
                  <th className="py-2 pr-3 font-normal">Beoordeling</th>
                  <th className="py-2 font-normal">Aantal reviews</th>
                </tr>
              </thead>
              <tbody>
                {[...analysis.ratingSeries]
                  .reverse()
                  .slice(0, 14)
                  .map((point) => (
                    <tr key={point.capturedOn.toISOString()} className="border-b border-border">
                      <td className="py-2 pr-3 text-text">{formatDate(point.capturedOn)}</td>
                      <td className="py-2 pr-3 text-text">{point.rating.toFixed(1)}</td>
                      <td className="py-2 text-text">{point.reviewCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-4 text-body-sm text-muted">
          Dit is een verhouding op totaalniveau, geen koppeling per klant. De mail stuurt mensen
          rechtstreeks naar Google en een Google-review draagt geen bestelnummer, dus welke klant
          wat schreef is hier niet uit te lezen.
        </p>
      </section>
    </div>
  );
}
