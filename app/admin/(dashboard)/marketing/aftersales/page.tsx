import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAftersalesContent } from "@/lib/aftersales/schema";
import { aftersalesProviderStatus } from "@/lib/aftersales/provider";
import { AftersalesFlowEditor } from "./AftersalesFlowEditor";

export default async function AftersalesPage() {
  await connection();
  const [flow, deliveries] = await Promise.all([
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

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar marketing</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">Mailchimp · transactioneel</p>
          <h1 className="mt-1 text-heading-xl text-text">Aftersales-flow</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-muted">Bepaal welke persoonlijke e-mail klanten ontvangen na betaling en verzending.</p>
        </div>
        <span className={`inline-flex min-h-11 items-center rounded-full px-4 text-body-sm font-semibold ${aftersalesProviderStatus().provider === "mailchimp" ? "bg-emerald-100 text-emerald-800" : aftersalesProviderStatus().provider === "resend" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}>
          {aftersalesProviderStatus().label}
        </span>
      </div>
      <AftersalesFlowEditor
        initialFlow={initialFlow}
        initialDeliveries={initialDeliveries}
        provider={aftersalesProviderStatus().provider}
      />
    </div>
  );
}
