import { loadReviewAnalysis, loadReviewWorklist } from "@/lib/review-requests-db";
import { REVIEW_WORKLIST_MIN_AGE_DAYS, REVIEW_WORKLIST_WINDOW_DAYS } from "@/lib/review-requests";
import { ReviewRequestButton } from "../../bestellingen/ReviewRequestButton";

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

export default async function ReviewRequestsPage() {
  const now = new Date();
  const [worklist, analysis] = await Promise.all([loadReviewWorklist(now), loadReviewAnalysis(now)]);

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

        {worklist.outsideWindow > 0 ? (
          <p className="mt-4 text-body-sm text-muted">
            {worklist.outsideWindow} bestelling(en) komen wel in aanmerking maar zijn ouder dan{" "}
            {REVIEW_WORKLIST_WINDOW_DAYS} dagen. Die staan hier niet: ze in één keer wegsturen
            verbruikt de zesmaandengrens voor een groot deel van je klanten op dezelfde dag.
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
            Nog geen metingen. Zodra de dagelijkse taak loopt, verschijnt hier de beoordeling en
            het aantal reviews.
          </p>
        )}

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

        <p className="mt-4 text-body-sm text-muted">
          Dit is een verhouding op totaalniveau, geen koppeling per klant. De mail stuurt mensen
          rechtstreeks naar Google en een Google-review draagt geen bestelnummer, dus welke klant
          wat schreef is hier niet uit te lezen.
        </p>
      </section>
    </div>
  );
}
