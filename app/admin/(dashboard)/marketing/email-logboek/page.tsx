import Link from "next/link";
import { EmailDeliveryKind, EmailDeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  aftersalesProviderStatus,
  checkTransactionalProviderReadiness,
} from "@/lib/aftersales/provider";
import { RetryEmailButton } from "./RetryEmailButton";

const KIND_LABELS: Record<EmailDeliveryKind, string> = {
  ORDER_CONFIRMATION: "Bestelbevestiging",
  ORDER_FULFILLED: "Verzendbevestiging",
  AFTERSALES_TEST: "Testmail",
  BACK_IN_STOCK: "Voorraadmelding",
  BUSINESS_ORDER_LIST: "Zakelijke bestellijst",
  BUSINESS_INVITATION: "Uitnodiging zakelijke omgeving",
  BUSINESS_ORDER_LIST_CHANGED: "Zakelijke bestellijst gewijzigd",
  BUSINESS_INVOICE: "Zakelijke factuur",
  NEW_ORDER_NOTIFICATION: "Nieuwe bestelling · Fedor",
};

const STATUS_LABELS: Record<EmailDeliveryStatus, string> = {
  PENDING: "Wordt verwerkt",
  ACCEPTED: "Geaccepteerd door provider",
  DELIVERED: "Afgeleverd",
  BOUNCED: "Bounced",
  COMPLAINED: "Spamklacht",
  REJECTED: "Geweigerd",
  SUPPRESSED: "Onderdrukt",
  FAILED: "Mislukt",
};

const STATUS_CLASSES: Record<EmailDeliveryStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  ACCEPTED: "border-blue-300 bg-blue-50 text-blue-800",
  DELIVERED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  BOUNCED: "border-orange-300 bg-orange-50 text-orange-900",
  COMPLAINED: "border-purple-300 bg-purple-50 text-purple-900",
  REJECTED: "border-red-300 bg-red-50 text-red-800",
  SUPPRESSED: "border-slate-300 bg-slate-50 text-slate-800",
  FAILED: "border-red-300 bg-red-50 text-red-800",
};

const EVENT_LABELS = {
  DELIVERED: "Afgeleverd",
  BOUNCED: "Bounce ontvangen",
  COMPLAINED: "Als spam gemarkeerd",
  REJECTED: "Door provider geweigerd",
  SUPPRESSED: "Adres onderdrukt",
} as const;

function validEnumValue<T extends string>(value: string | undefined, values: readonly T[]): T | undefined {
  return value && values.includes(value as T) ? value as T : undefined;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function TransactionalEmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; email?: string; orderId?: string }>;
}) {
  const params = await searchParams;
  const status = validEnumValue(params.status, Object.values(EmailDeliveryStatus));
  const kind = validEnumValue(params.kind, Object.values(EmailDeliveryKind));
  const email = params.email?.trim().slice(0, 320) || undefined;
  const orderId = params.orderId?.trim().slice(0, 100) || undefined;
  const where: Prisma.EmailDeliveryLogWhereInput = {
    status,
    kind,
    recipientEmail: email ? { contains: email, mode: "insensitive" } : undefined,
    orderId: orderId ? { contains: orderId } : undefined,
  };

  const [entries, grouped] = await Promise.all([
    prisma.emailDeliveryLog.findMany({
      where,
      include: {
        attempts: { orderBy: { attemptNumber: "desc" } },
        events: { orderBy: { occurredAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.emailDeliveryLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  const provider = aftersalesProviderStatus();
  const providerReadiness = await checkTransactionalProviderReadiness();

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">
            Transactionele e-mail
          </p>
          <h1 className="mt-1 text-heading-xl text-text">Maillogboek</h1>
          <p className="mt-1 max-w-3xl text-body-sm leading-6 text-muted">
            Elke aanbiedingspoging met ontvanger, bestelling, inhoudssnapshot, provider-ID en exacte fout.
            “Geaccepteerd” betekent dat de provider de mail heeft aangenomen; het is geen onbewezen afleverclaim.
          </p>
        </div>
        <div className={`rounded-panel border p-4 text-body-sm ${provider.provider === "mailchimp" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : provider.provider === "resend" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-red-300 bg-red-50 text-red-900"}`}>
          <p className="font-semibold">{provider.label}</p>
          <p className="mt-1 max-w-md text-xs leading-5">{provider.detail}</p>
          <p className={`mt-2 max-w-md text-xs font-semibold ${providerReadiness.ready ? "text-emerald-800" : "text-red-800"}`}>
            {providerReadiness.ready ? "Verzendklaar" : "Niet verzendklaar"}: {providerReadiness.message}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {Object.values(EmailDeliveryStatus).map((value) => (
          <div key={value} className={`rounded-panel border p-4 ${STATUS_CLASSES[value]}`}>
            <p className="text-xs font-bold uppercase tracking-heading">{STATUS_LABELS[value]}</p>
            <p className="mt-1 font-heading text-heading-lg">{counts[value] ?? 0}</p>
          </div>
        ))}
      </div>

      <form className="mt-6 grid grid-cols-1 gap-3 rounded-panel border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-body-sm font-semibold">
          Status
          <select name="status" defaultValue={status ?? ""} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3">
            <option value="">Alle statussen</option>
            {Object.values(EmailDeliveryStatus).map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
        </label>
        <label className="text-body-sm font-semibold">
          Type
          <select name="kind" defaultValue={kind ?? ""} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3">
            <option value="">Alle typen</option>
            {Object.values(EmailDeliveryKind).map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
          </select>
        </label>
        <label className="text-body-sm font-semibold">
          E-mailadres
          <input name="email" type="search" defaultValue={email ?? ""} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3" />
        </label>
        <label className="text-body-sm font-semibold">
          Bestelnummer
          <input name="orderId" type="search" defaultValue={orderId ?? ""} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3" />
        </label>
        <button type="submit" className="min-h-11 self-end rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button">
          Filteren
        </button>
      </form>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-panel border border-border bg-surface px-5 py-10 text-center text-body-sm text-muted">
          Geen e-mails gevonden voor deze filters.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <details key={entry.id} className="rounded-panel border border-border bg-surface shadow-card">
              <summary className="cursor-pointer list-none p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_CLASSES[entry.status]}`}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-heading text-muted">{KIND_LABELS[entry.kind]}</span>
                    </div>
                    <p className="mt-2 break-words font-heading text-body-md font-semibold text-text">{entry.subject}</p>
                    <p className="mt-1 break-all text-body-sm text-muted">Aan: {entry.recipientName ? `${entry.recipientName} · ` : ""}{entry.recipientEmail}</p>
                  </div>
                  <div className="shrink-0 text-body-sm text-muted lg:text-right">
                    <p>{formatDate(entry.lastProviderEventAt ?? entry.acceptedAt ?? entry.lastAttemptAt ?? entry.createdAt)}</p>
                    <p className="mt-1 font-mono text-xs">{entry.provider ?? "Geen provider"}</p>
                  </div>
                </div>
              </summary>
              <div className="border-t border-border p-4 sm:p-5">
                <dl className="grid grid-cols-1 gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="font-semibold text-muted">Bestelling</dt><dd className="mt-1 break-all">{entry.orderId ? <Link href={`/admin/bestellingen/${entry.orderId}`} className="text-accent-hover underline underline-offset-4">{entry.orderId}</Link> : "—"}</dd></div>
                  <div><dt className="font-semibold text-muted">Provider-ID</dt><dd className="mt-1 break-all font-mono text-xs">{entry.providerMessageId ?? "—"}</dd></div>
                  <div><dt className="font-semibold text-muted">Providerstatus</dt><dd className="mt-1">{entry.providerStatus ?? "—"}</dd></div>
                  <div><dt className="font-semibold text-muted">Idempotentiesleutel</dt><dd className="mt-1 break-all font-mono text-xs">{entry.idempotencyKey}</dd></div>
                </dl>

                {entry.errorMessage ? (
                  <div className="mt-4 rounded-button border border-red-300 bg-red-50 p-3 text-body-sm text-red-900">
                    <p className="font-semibold">{entry.errorCode ?? "VERZENDFOUT"}</p>
                    <p className="mt-1 break-words">{entry.errorMessage}</p>
                  </div>
                ) : null}

                <details className="mt-4 rounded-button border border-border bg-background p-3">
                  <summary className="cursor-pointer font-heading text-body-sm font-semibold">Exacte tekstinhoud bekijken</summary>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-muted">{entry.textBody}</pre>
                </details>

                <div className="mt-4">
                  <h2 className="font-heading text-body-sm font-semibold">Pogingen ({entry.attempts.length})</h2>
                  <div className="mt-2 space-y-2">
                    {entry.attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-button border border-border bg-background p-3 text-xs text-muted">
                        <p className="font-semibold text-text">Poging {attempt.attemptNumber} · {attempt.provider} · {attempt.status}</p>
                        <p className="mt-1">Gestart: {formatDate(attempt.startedAt)} · Afgerond: {formatDate(attempt.completedAt)}</p>
                        {attempt.errorMessage ? <p className="mt-1 break-words text-red-700">{attempt.errorCode}: {attempt.errorMessage}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className="font-heading text-body-sm font-semibold">
                    Provider-events ({entry.events.length})
                  </h2>
                  {entry.events.length === 0 ? (
                    <p className="mt-2 rounded-button border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                      Nog geen afleverevent ontvangen. Geaccepteerd is niet hetzelfde als afgeleverd.
                    </p>
                  ) : (
                    <ol className="mt-2 space-y-2">
                      {entry.events.map((event) => (
                        <li key={event.id} className="rounded-button border border-border bg-background p-3 text-xs text-muted">
                          <p className="font-semibold text-text">
                            {EVENT_LABELS[event.type]} · {formatDate(event.occurredAt)}
                          </p>
                          <p className="mt-1">
                            {event.providerEvent}
                            {event.reasonCode ? ` · ${event.reasonCode}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {entry.status === "FAILED" ? <RetryEmailButton logId={entry.id} /> : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
