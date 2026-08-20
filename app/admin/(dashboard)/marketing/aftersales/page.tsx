import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAftersalesContent } from "@/lib/aftersales/schema";
import {
  aftersalesProviderStatus,
  checkTransactionalProviderReadiness,
} from "@/lib/aftersales/provider";
import { isAftersalesSchemaUnavailable } from "@/lib/aftersales/database";
import { AftersalesFlowEditor } from "./AftersalesFlowEditor";

export default async function AftersalesPage() {
  await connection();
  let flow;
  let deliveries;
  try {
    [flow, deliveries] = await Promise.all([
      prisma.aftersalesFlow.findFirst({
        orderBy: { createdAt: "asc" },
        include: { steps: { orderBy: { position: "asc" } } },
      }),
      prisma.aftersalesDelivery.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          order: { select: { id: true, contactName: true, contactEmail: true } },
          step: { select: { name: true } },
        },
      }),
    ]);
  } catch (error) {
    if (!isAftersalesSchemaUnavailable(error)) throw error;

    return (
      <div>
        <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
          ← Terug naar marketing
        </Link>
        <h1 className="mt-3 text-heading-xl text-text">Aftersales-flow niet geïnstalleerd</h1>
        <div className="mt-6 rounded-panel border border-amber-300 bg-amber-50 p-5 text-body-sm text-amber-950">
          <p className="font-semibold">De applicatiecode is nieuwer dan het databaseschema.</p>
          <p className="mt-2">
            De tabellen <code>AftersalesFlow</code>, <code>AftersalesStep</code> en{" "}
            <code>AftersalesDelivery</code> ontbreken. Voer migratie{" "}
            <code>20260819010000_add_aftersales_automation</code> gecontroleerd uit via de
            releasepipeline. Tot die tijd blijft de bestaande bestelbevestiging actief.
          </p>
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div>
        <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar marketing</Link>
        <h1 className="mt-3 text-heading-xl text-text">Aftersales</h1>
        <div className="mt-6 rounded-panel border border-red-200 bg-red-50 p-5 text-body-sm text-red-800">
          De aftersales-flow ontbreekt. Voer eerst de database-migratie uit.
        </div>
      </div>
    );
  }

  const initialFlow = {
    id: flow.id,
    name: flow.name,
    isActive: flow.isActive,
    version: flow.updatedAt.toISOString(),
    steps: flow.steps.map((step) => ({
      id: step.id,
      trigger: step.trigger,
      name: step.name,
      position: step.position,
      enabled: step.enabled,
      delayMinutes: 0 as const,
      content: parseAftersalesContent(step.content),
    })),
  };
  const initialDeliveries = deliveries.map((delivery) => ({
    id: delivery.id,
    status: delivery.status,
    provider: delivery.provider,
    errorMessage: delivery.errorMessage,
    createdAt: delivery.createdAt.toISOString(),
    sentAt: delivery.sentAt?.toISOString() ?? null,
    orderId: delivery.order.id,
    customerName: delivery.order.contactName,
    customerEmail: delivery.order.contactEmail,
    stepName: delivery.step.name,
  }));
  const providerStatus = aftersalesProviderStatus();
  const providerReadiness = await checkTransactionalProviderReadiness();
  const showMailchimpUpgrade =
    providerReadiness.provider === "mailchimp" && providerReadiness.reason === "demo_mode";
  const showMailchimpQuotaCheck =
    providerReadiness.provider === "mailchimp" && providerReadiness.reason === "quota_unavailable";

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar marketing</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">Mailchimp · transactioneel</p>
          <h1 className="mt-1 text-heading-xl text-text">Aftersales-flow</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-muted">Bepaal welke persoonlijke e-mail klanten ontvangen na betaling en verzending.</p>
        </div>
        <div className={`max-w-md rounded-panel border p-4 text-body-sm ${providerStatus.provider === "mailchimp" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : providerStatus.provider === "resend" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-red-300 bg-red-50 text-red-900"}`}>
          <p className="font-semibold">{providerStatus.label}</p>
          <p className="mt-1 text-xs leading-5">{providerStatus.detail}</p>
          <p className={`mt-2 text-xs font-semibold ${providerReadiness.ready ? "text-emerald-800" : "text-red-800"}`}>
            {providerReadiness.ready ? "Verzendklaar" : "Niet verzendklaar"}: {providerReadiness.message}
          </p>
          {showMailchimpUpgrade ? (
            <div className="mt-3 border-t border-emerald-200 pt-3">
              <p id="mailchimp-transactional-plan-note" className="text-xs leading-5">
                Laagste bundel: 1 blok van 25.000 transactionele e-mails per maand.
              </p>
              <a
                href="https://admin.mailchimp.com/account/billing/plans"
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby="mailchimp-transactional-plan-note"
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-accent bg-accent px-4 py-2 text-center font-heading text-body-sm font-bold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              >
                Activeer laagste Transactional-bundel
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          ) : null}
          {showMailchimpQuotaCheck ? (
            <div className="mt-3 border-t border-emerald-200 pt-3">
              <p id="mailchimp-transactional-quota-note" className="text-xs leading-5">
                Mailchimp accepteert de API-key, maar geeft nog quota 0 terug. Controleer in Billing dat
                Transactional Email op minimaal 1 blok van 25.000 e-mails staat en dat de betaling is afgerond.
              </p>
              <a
                href="https://admin.mailchimp.com/account/billing/plans"
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby="mailchimp-transactional-quota-note"
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-accent bg-accent px-4 py-2 text-center font-heading text-body-sm font-bold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              >
                Rond laagste bundel af in Billing
                <span aria-hidden="true">↗</span>
              </a>
              <a
                href="https://mandrillapp.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 text-center font-semibold underline underline-offset-4"
              >
                Controleer daarna de Transactional-quota
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          ) : null}
          <Link href="/admin/marketing/email-logboek" className="mt-3 inline-block font-semibold underline underline-offset-4">
            Open maillogboek
          </Link>
        </div>
      </div>
      <AftersalesFlowEditor
        initialFlow={initialFlow}
        initialDeliveries={initialDeliveries}
        provider={providerReadiness.ready ? providerStatus.provider : "none"}
      />
    </div>
  );
}
