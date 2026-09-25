import Link from "next/link";
import { ArrowRight, FilePenLine, Images, ImageIcon, LockKeyhole, WandSparkles } from "lucide-react";
import { designStudioModules } from "@/lib/design-studio/modules";
import { getDesignStudioProviderStatuses } from "@/lib/design-studio/provider-status";
import { copywriterBadge, photoRoomBadge, plannedBadge, vModelBadge, type DesignStudioBadge } from "@/lib/design-studio/provider-badges";

const moduleIcons = {
  "product-photos": ImageIcon,
  "campaign-assets": WandSparkles,
  labels: LockKeyhole,
  copywriter: FilePenLine,
} as const;

export default async function DesignStudioPage() {
  const statuses = await getDesignStudioProviderStatuses();
  const badges: Record<string, DesignStudioBadge> = {
    "product-photos": photoRoomBadge(statuses.photoroom),
    "campaign-assets": vModelBadge(statuses.vmodel),
    copywriter: copywriterBadge(statuses.copywriter),
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-heading text-body-sm font-bold uppercase tracking-[0.12em] text-accent-ink">Creatie</p>
          <h1 className="mt-2 text-heading-xl text-text">Design Studio</h1>
          <p className="mt-3 text-body-md leading-7 text-muted">Maak en beoordeel visuele productmaterialen vanuit één vaste werkomgeving. Originele bestanden blijven altijd behouden.</p>
        </div>
        <Link href="/admin/design-studio/mediabibliotheek" className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-text hover:border-border-hover"><Images className="h-4 w-4" aria-hidden="true" />Mediabibliotheek</Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {designStudioModules.map((module) => {
          const Icon = moduleIcons[module.id as keyof typeof moduleIcons] || WandSparkles;
          const badge = module.status === "ACTIVE" ? badges[module.id] || plannedBadge : plannedBadge;
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-card bg-accent/15 text-accent-ink"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                <span role="status" className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
              </div>
              <h2 className="mt-5 text-heading-md text-text">{module.title}</h2>
              <p className="mt-2 min-h-12 text-body-sm leading-6 text-muted">{module.description}</p>
              {module.provider ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Met {module.provider}{badge.detail ? ` · ${badge.detail}` : ""}</p> : null}
              {module.status === "ACTIVE" ? <span className="mt-5 inline-flex min-h-11 items-center gap-2 font-heading text-body-sm font-bold text-accent-ink">Open werkruimte <ArrowRight className="h-4 w-4" aria-hidden="true" /></span> : null}
            </>
          );
          return module.status === "ACTIVE" ? (
            <Link key={module.id} href={module.href} className="rounded-panel border border-border bg-surface p-6 shadow-card transition duration-hover-fast hover:-translate-y-0.5 hover:border-border-hover hover:shadow-card-hover">{content}</Link>
          ) : (
            <section key={module.id} aria-disabled="true" className="rounded-panel border border-border bg-surface/70 p-6 opacity-75">{content}</section>
          );
        })}
      </div>
    </div>
  );
}
