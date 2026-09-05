import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAftersalesSchemaUnavailable } from "@/lib/aftersales/database";
import { backfillAftersalesFlows, backfillAftersalesSteps } from "@/lib/aftersales/defaults";
import { AftersalesFlowList, type AftersalesFlowSummary } from "./AftersalesFlowList";

export default async function AftersalesListPage() {
  await connection();
  let flows;
  try {
    await backfillAftersalesFlows();
    flows = await prisma.aftersalesFlow.findMany({
      orderBy: { flowType: "asc" },
      include: { steps: { select: { trigger: true } } },
    });
    for (const flow of flows) {
      await backfillAftersalesSteps(flow.id, flow.flowType, flow.steps.map((step) => step.trigger));
    }
    if (flows.some((flow) => flow.steps.length === 0)) {
      flows = await prisma.aftersalesFlow.findMany({
        orderBy: { flowType: "asc" },
        include: { steps: { select: { trigger: true } } },
      });
    }
  } catch (error) {
    if (!isAftersalesSchemaUnavailable(error)) throw error;
    return (
      <div>
        <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
          ← Terug naar marketing
        </Link>
        <h1 className="mt-3 text-heading-xl text-text">Mail flows niet geïnstalleerd</h1>
        <div className="mt-6 rounded-panel border border-amber-300 bg-amber-50 p-5 text-body-sm text-amber-950">
          <p className="font-semibold">De applicatiecode is nieuwer dan het databaseschema.</p>
          <p className="mt-2">
            Voer de openstaande Aftersales-migraties gecontroleerd uit via de releasepipeline.
            Tot die tijd blijft de bestaande bestelbevestiging actief.
          </p>
        </div>
      </div>
    );
  }

  const summaries: AftersalesFlowSummary[] = flows.map((flow) => ({
    id: flow.id,
    name: flow.name,
    flowType: flow.flowType,
    isActive: flow.isActive,
    stepCount: flow.steps.length,
    updatedAt: flow.updatedAt.toISOString(),
  }));

  return (
    <div>
      <Link href="/admin/marketing" className="text-body-sm text-accent-hover underline underline-offset-4">
        ← Terug naar marketing
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Mail flows</h1>
        <p className="mt-1 max-w-2xl text-body-sm text-muted">
          Beheer de automatische mailings voor particuliere en zakelijke klanten apart.
        </p>
      </div>
      <AftersalesFlowList flows={summaries} />
    </div>
  );
}
