"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Mail,
  PackageCheck,
  Plus,
  Save,
  Send,
  Truck,
  X,
} from "lucide-react";
import type {
  AftersalesBlock,
  AftersalesBlockType,
  AftersalesCanvas,
  AftersalesColumn,
  AftersalesContent,
  AftersalesFlowInput,
  AftersalesRow,
  AftersalesTriggerValue,
} from "@/lib/aftersales/schema";
import { AFTERSALES_BLOCK_TYPES, AFTERSALES_TOKENS_BY_TRIGGER } from "@/lib/aftersales/schema";
import { renderAftersalesCanvas } from "@/lib/aftersales/canvas-renderer";
import type { Locale } from "@/lib/i18n";

type MediaOption = { id: string; url: string; originalFilename: string };

let blockIdCounter = 0;
function newBlockId(prefix: string): string {
  blockIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${blockIdCounter}`;
}

const BLOCK_TYPE_LABELS: Record<AftersalesBlockType, string> = {
  text: "Tekst",
  image: "Afbeelding",
  hero: "Hero",
  banner: "Banner",
  button: "Knop",
  table: "Tabel",
  grid: "Grid",
  footer: "Footer",
  spacer: "Spacer",
  customHtml: "Custom HTML",
};

function createBlock(type: AftersalesBlockType): AftersalesBlock {
  const id = newBlockId(type);
  switch (type) {
    case "text":
      return { id, type, font: "SANS", size: "STANDAARD", color: "#141414", align: "left", bold: false, italic: false };
    case "image":
      return { id, type, mediaUrl: null, alt: "", width: 544, align: "center", linkUrl: null };
    case "hero":
      return { id, type, backgroundUrl: null, backgroundColor: "#333333", buttonColor: "#e0b200", buttonTextColor: "#141414" };
    case "banner":
      return { id, type, backgroundUrl: null, backgroundColor: "#fbe9a0", textColor: "#141414" };
    case "button":
      return { id, type, backgroundColor: "#e0b200", textColor: "#141414", borderRadius: 8, linkUrl: null };
    case "table":
      return { id, type, headerCount: 0, rowIds: [] };
    case "grid":
      return { id, type, items: [] };
    case "footer":
      return { id, type };
    case "spacer":
      return { id, type, heightPx: 24, showDivider: false };
    case "customHtml":
      return { id, type };
  }
}

function newColumn(widthFraction: number): AftersalesColumn {
  return { id: newBlockId("col"), widthFraction, backgroundColor: "#ffffff", padding: 16, blocks: [] };
}

function newRow(): AftersalesRow {
  return { id: newBlockId("row"), backgroundColor: "#ffffff", padding: 24, columns: [newColumn(1)] };
}

type Delivery = {
  id: string;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  provider: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  orderId: string;
  customerName: string;
  customerEmail: string;
  stepName: string;
};

type Props = {
  initialFlow: AftersalesFlowInput;
  initialDeliveries: Delivery[];
  provider: "mailchimp" | "resend" | "none";
};

const triggerCopy: Record<AftersalesTriggerValue, {
  event: string;
  description: string;
}> = {
  ORDER_PAID: {
    event: "Betaling ontvangen",
    description: "Start zodra Mollie de betaling definitief als betaald bevestigt.",
  },
  ORDER_FULFILLED: {
    event: "Bestelling verzonden",
    description: "Start bij de status Verzonden en gebruikt de track-en-tracecode.",
  },
  BACK_IN_STOCK: {
    event: "Product weer op voorraad",
    description: "Start zodra een klant zich had aangemeld en het product weer bestelbaar is.",
  },
  BUSINESS_ORDER_PAID: {
    event: "Zakelijke betaling ontvangen",
    description: "Start zodra Mollie de betaling van een zakelijke bestelling definitief als betaald bevestigt.",
  },
  BUSINESS_ORDER_FULFILLED: {
    event: "Zakelijke bestelling verzonden",
    description: "Start bij de status Verzonden voor een zakelijke bestelling en gebruikt de track-en-tracecode.",
  },
};

const triggerIcons: Record<AftersalesTriggerValue, typeof PackageCheck> = {
  ORDER_PAID: PackageCheck,
  ORDER_FULFILLED: Truck,
  BACK_IN_STOCK: Bell,
  BUSINESS_ORDER_PAID: PackageCheck,
  BUSINESS_ORDER_FULFILLED: Truck,
};

const localeLabels: Record<Locale, string> = { nl: "Nederlands", en: "Engels", fr: "Frans" };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sampleValue(value: string): string {
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, token: string) => ({
    first_name: "Sophie",
    customer_name: "Sophie de Vries",
    order_number: "DN-2026-1842",
    order_total: "€ 42,95",
    tracking_code: "3SNOTEN1234567",
    order_url: "https://denotenman.com/nl/order/DN-2026-1842",
    product_name: "Cashewnoten gebrand",
    product_url: "https://denotenman.com/nl/producten/cashewnoten-gebrand",
    business_name: "Restaurant De Notenboom",
    contact_name: "Jan Jansen",
  }[token] ?? ""));
}

function previewDocument(
  content: AftersalesContent[Locale],
  trigger: AftersalesTriggerValue,
  canvas: AftersalesCanvas,
  logoUrl: string | null
): string {
  const subject = sampleValue(content.subject);
  const brandBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="De Notenman" style="display:block;height:32px;width:auto;margin:0 0 12px" />`
    : `<p style="margin:0;color:#806600;font-size:12px;font-weight:700;letter-spacing:.08em">DE NOTENMAN</p>`;
  const resolvedBlockText = Object.fromEntries(Object.entries(content.blockText).map(([key, value]) => [key, sampleValue(value)]));
  const contentHtml = renderAftersalesCanvas(canvas, resolvedBlockText, {
    escapeText: escapeHtml,
    resolveText: (key) => resolvedBlockText[key] ?? "",
    defaultActionUrl: "#",
  });
  const orderNumberBox = trigger === "BACK_IN_STOCK" ? "" : "<div style=\"margin:18px 0;padding:14px;border:1px solid #ded7ca;border-radius:8px;background:#f6f3ee;font-size:14px\"><strong>Bestelnummer:</strong> DN-2026-1842</div>";
  const detail = trigger === "ORDER_FULFILLED"
    ? "<p style=\"margin:18px 0 0;font-size:14px\"><strong>Track &amp; trace:</strong> 3SNOTEN1234567</p>"
    : trigger === "ORDER_PAID"
      ? "<div style=\"margin-top:20px;border-top:1px solid #e4dfd5;padding-top:16px;font-size:14px\"><p><strong>2× Cashewnoten gebrand</strong><span style=\"float:right\">€ 13,90</span></p><p><strong>Totaal</strong><span style=\"float:right\">€ 42,95</span></p></div>"
      : "";
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f6f3ee"><div style="padding:18px 10px"><div style="max-width:600px;margin:auto;overflow:hidden;border:1px solid #ded7ca;border-radius:12px;background:#fff"><div style="height:5px;background:#e0b200"></div><div style="padding:28px">${brandBlock}${contentHtml}${orderNumberBox}${detail}</div></div></div></body></html>`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AftersalesFlowEditor({ initialFlow, initialDeliveries, provider }: Props) {
  const router = useRouter();
  const [flow, setFlow] = useState(initialFlow);
  const [selectedStepId, setSelectedStepId] = useState(initialFlow.steps[0]?.id ?? "");
  const [locale, setLocale] = useState<Locale>("nl");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [testEmail, setTestEmail] = useState("");
  const [mediaPickerFor, setMediaPickerFor] = useState<"logo" | "step" | { gridIndex: number } | null>(null);
  const [mediaOptions, setMediaOptions] = useState<MediaOption[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const selectedColumnRef = useRef<{ rowId: string; columnId: string } | null>(null);

  const selectedStep = flow.steps.find((step) => step.id === selectedStepId) ?? flow.steps[0];
  const preview = useMemo(
    () => selectedStep ? previewDocument(selectedStep.content.locales[locale], selectedStep.trigger, selectedStep.content.canvas, flow.logoUrl) : "",
    [selectedStep, locale, flow.logoUrl]
  );

  function markChanged(next: AftersalesFlowInput) {
    setFlow(next);
    setDirty(true);
    setError(null);
    setMessage(null);
  }

  function updateStep(stepId: string, updater: (step: AftersalesFlowInput["steps"][number]) => AftersalesFlowInput["steps"][number]) {
    markChanged({ ...flow, steps: flow.steps.map((step) => step.id === stepId ? updater(step) : step) });
  }

  function updateContent(field: keyof AftersalesContent[Locale], value: string) {
    if (!selectedStep) return;
    updateStep(selectedStep.id, (step) => ({
      ...step,
      content: { ...step.content, locales: { ...step.content.locales, [locale]: { ...step.content.locales[locale], [field]: value } } },
    }));
  }

  function updateCanvas(stepId: string, updater: (canvas: AftersalesRow[]) => AftersalesRow[]) {
    updateStep(stepId, (step) => ({ ...step, content: { ...step.content, canvas: { rows: updater(step.content.canvas.rows) } } }));
  }

  function addRow() {
    if (!selectedStep) return;
    updateCanvas(selectedStep.id, (rows) => [...rows, newRow()]);
  }

  function removeRow(rowId: string) {
    if (!selectedStep) return;
    updateCanvas(selectedStep.id, (rows) => rows.length > 1 ? rows.filter((row) => row.id !== rowId) : rows);
  }

  function addColumn(rowId: string) {
    if (!selectedStep) return;
    updateCanvas(selectedStep.id, (rows) => rows.map((row) => row.id === rowId && row.columns.length < 4
      ? { ...row, columns: [...row.columns, newColumn(1 / (row.columns.length + 1))] }
      : row));
  }

  function removeColumn(rowId: string, columnId: string) {
    if (!selectedStep) return;
    updateCanvas(selectedStep.id, (rows) => rows.map((row) => row.id === rowId && row.columns.length > 1
      ? { ...row, columns: row.columns.filter((column) => column.id !== columnId) }
      : row));
  }

  function addBlock(rowId: string, columnId: string, type: AftersalesBlockType) {
    if (!selectedStep) return;
    const block = createBlock(type);
    updateCanvas(selectedStep.id, (rows) => rows.map((row) => row.id !== rowId ? row : {
      ...row,
      columns: row.columns.map((column) => column.id !== columnId ? column : { ...column, blocks: [...column.blocks, block] }),
    }));
    setSelectedBlockId(block.id);
  }

  function removeBlock(rowId: string, columnId: string, blockId: string) {
    if (!selectedStep) return;
    updateCanvas(selectedStep.id, (rows) => rows.map((row) => row.id !== rowId ? row : {
      ...row,
      columns: row.columns.map((column) => column.id !== columnId ? column : { ...column, blocks: column.blocks.filter((block) => block.id !== blockId) }),
    }));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function updateBlock(rowId: string, columnId: string, blockId: string, updater: (block: AftersalesBlock) => AftersalesBlock) {
    if (!selectedStep) return;
    updateCanvas(selectedStep.id, (rows) => rows.map((row) => row.id !== rowId ? row : {
      ...row,
      columns: row.columns.map((column) => column.id !== columnId ? column : {
        ...column,
        blocks: column.blocks.map((block) => block.id !== blockId ? block : updater(block)),
      }),
    }));
  }

  async function openMediaPicker(target: "logo" | "step" | { gridIndex: number }) {
    setMediaPickerFor(target);
    setMediaLoading(true);
    try {
      const response = await fetch("/api/admin/media");
      const body = await response.json().catch(() => null) as { assets?: MediaOption[] } | null;
      setMediaOptions(body?.assets ?? []);
    } finally {
      setMediaLoading(false);
    }
  }

  function pickMedia(url: string) {
    if (mediaPickerFor === "logo") {
      markChanged({ ...flow, logoUrl: url });
    } else if (mediaPickerFor === "step") {
      if (selectedStep) {
        updateStep(selectedStep.id, (step) => ({ ...step, content: { ...step.content, design: { ...step.content.design, mediaUrl: url } } }));
      }
    } else if (mediaPickerFor && typeof mediaPickerFor === "object") {
      const { gridIndex } = mediaPickerFor;
      if (selectedStep) {
        updateStep(selectedStep.id, (step) => ({
          ...step,
          content: {
            ...step.content,
            design: {
              ...step.content.design,
              gridItems: step.content.design.gridItems.map((item, i) => (i === gridIndex ? { ...item, imageUrl: url } : item)),
            },
          },
        }));
      }
    }
    setMediaPickerFor(null);
  }

  function reorder(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const next = [...flow.steps];
    const sourceIndex = next.findIndex((step) => step.id === sourceId);
    const targetIndex = next.findIndex((step) => step.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    markChanged({ ...flow, steps: next.map((step, position) => ({ ...step, position })) });
  }

  function move(stepId: string, delta: number) {
    const index = flow.steps.findIndex((step) => step.id === stepId);
    const target = flow.steps[index + delta];
    if (index < 0 || !target) return;
    reorder(stepId, target.id);
  }

  async function save() {
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/marketing/aftersales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flow),
      });
      const body = await response.json().catch(() => null) as { error?: string; message?: string; flow?: { updatedAt: string } } | null;
      if (!response.ok) {
        setError(
          body?.error === "STALE_FLOW"
            ? "Deze flow is ondertussen door iemand anders gewijzigd. Vernieuw de pagina."
            : body?.error === "PROVIDER_NOT_CONFIGURED"
              ? "Configureer eerst Mailchimp Transactional of de Resend-fallback."
              : body?.error === "PROVIDER_NOT_READY"
                ? body.message ?? "De mailprovider is nog niet verzendklaar."
              : "Opslaan is niet gelukt. Controleer alle velden en probeer opnieuw."
        );
        return;
      }
      if (body?.flow?.updatedAt) setFlow((current) => ({ ...current, version: body.flow!.updatedAt }));
      setDirty(false);
      setMessage(flow.isActive ? "Flow opgeslagen en actief." : "Flow als concept opgeslagen.");
      router.refresh();
    } catch {
      setError("Opslaan is mislukt door een netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!selectedStep || !testEmail.trim()) {
      setError("Vul een geldig testmailadres in.");
      return;
    }
    if (dirty) {
      setError("Sla de flow eerst op; de test gebruikt de opgeslagen Mailchimp-template.");
      return;
    }
    setBusy("test");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/marketing/aftersales/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: selectedStep.id, email: testEmail.trim() }),
      });
      const body = await response.json().catch(() => null) as { error?: string; message?: string; provider?: string } | null;
      if (!response.ok) {
        setError(
          body?.error === "NO_SAMPLE_ORDER"
            ? "Er is nog geen geschikte betaalde bestelling of testbestelling om als voorbeeld te gebruiken."
            : body?.message || "De testmail is niet geaccepteerd door de provider."
        );
        return;
      }
      setMessage(`Testmail geaccepteerd via ${body?.provider === "MAILCHIMP_TRANSACTIONAL" ? "Mailchimp Transactional" : "Resend"}. Controleer het maillogboek voor de provider-ID.`);
    } catch {
      setError("De testmail mislukte door een netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-panel border border-border bg-surface shadow-card">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div className="min-w-0 flex-1">
            <label htmlFor="flow-name" className="text-xs font-bold uppercase tracking-heading text-muted">Flownaam</label>
            <input id="flow-name" value={flow.name} maxLength={120} onChange={(event) => markChanged({ ...flow, name: event.target.value })} className="mt-1 min-h-11 w-full max-w-lg rounded-button border border-border bg-background px-3 py-2 font-heading text-heading-md font-semibold" />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full border border-border bg-background px-4">
            <input type="checkbox" checked={flow.isActive} disabled={provider === "none"} onChange={(event) => markChanged({ ...flow, isActive: event.target.checked })} className="h-5 w-5 accent-amber-500" />
            <span className="font-heading text-body-sm font-bold">{flow.isActive ? "Flow actief" : "Concept"}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border p-5 md:p-6">
          <p className="text-xs font-bold uppercase tracking-heading text-muted">Logo in mailheader</p>
          {flow.logoUrl ? (
            <img src={flow.logoUrl} alt="Logo" className="h-8 w-auto rounded border border-border bg-white p-1" />
          ) : (
            <span className="text-body-sm text-muted">Standaard "DE NOTENMAN"-tekst</span>
          )}
          <button type="button" onClick={() => openMediaPicker("logo")} className="inline-flex min-h-9 items-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold"><ImageIcon size={14} />Kies uit mediabibliotheek</button>
          {flow.logoUrl ? (
            <button type="button" onClick={() => markChanged({ ...flow, logoUrl: null })} className="text-xs font-semibold text-red-700">Verwijder logo</button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(330px,0.75fr)_minmax(0,1.25fr)]">
          <div className="border-b border-border bg-[#f3efe7] p-4 sm:p-6 xl:border-b-0 xl:border-r">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-heading text-accent-hover">Automatisering</p>
                <h2 className="mt-1 text-heading-md">Visuele flow</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted shadow-card">Sleep om te ordenen</span>
            </div>

            <div className="relative space-y-4" role="list" aria-label="Aftersales-stappen">
              <div className="absolute bottom-8 left-6 top-8 w-px bg-[#cdbf9b]" aria-hidden="true" />
              {flow.steps.map((step, index) => {
                const selected = step.id === selectedStep?.id;
                const event = triggerCopy[step.trigger];
                return (
                  <div
                    key={step.id}
                    role="listitem"
                    draggable
                    onDragStart={(dragEvent) => {
                      dragEvent.dataTransfer.effectAllowed = "move";
                      dragEvent.dataTransfer.setData("text/plain", step.id);
                      setDraggingId(step.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(dragEvent) => dragEvent.preventDefault()}
                    onDrop={(dragEvent) => {
                      dragEvent.preventDefault();
                      reorder(dragEvent.dataTransfer.getData("text/plain") || draggingId || "", step.id);
                      setDraggingId(null);
                    }}
                    className={`relative z-10 rounded-panel border bg-white p-4 shadow-card transition ${draggingId === step.id ? "opacity-50" : "opacity-100"} ${selected ? "border-accent ring-2 ring-accent/20" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-contrast text-accent">
                        {(() => { const TriggerIcon = triggerIcons[step.trigger]; return <TriggerIcon size={22} />; })()}
                      </div>
                      <button type="button" onClick={() => setSelectedStepId(step.id)} className="min-w-0 flex-1 text-left">
                        <span className="text-xs font-bold uppercase tracking-heading text-muted">Trigger {index + 1}</span>
                        <span className="mt-1 block font-heading text-body-md font-bold text-text">{event.event}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted">{event.description}</span>
                      </button>
                      <GripVertical className="mt-1 shrink-0 cursor-grab text-muted" aria-label="Sleepgreep" />
                    </div>
                    <div className="ml-6 mt-4 border-l-2 border-dashed border-accent pl-8">
                      <button type="button" onClick={() => setSelectedStepId(step.id)} className="flex min-h-11 w-full items-center gap-3 rounded-button border border-border bg-background px-3 py-2 text-left">
                        <Mail size={18} className="shrink-0 text-accent-hover" />
                        <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">{step.name}</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${step.enabled ? "bg-emerald-500" : "bg-slate-300"}`} aria-label={step.enabled ? "Ingeschakeld" : "Uitgeschakeld"} />
                      </button>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 sm:hidden">
                      <button type="button" onClick={() => move(step.id, -1)} disabled={index === 0} aria-label="Stap omhoog" className="flex h-11 w-11 items-center justify-center rounded-button border border-border disabled:opacity-30"><ArrowUp size={18} /></button>
                      <button type="button" onClick={() => move(step.id, 1)} disabled={index === flow.steps.length - 1} aria-label="Stap omlaag" className="flex h-11 w-11 items-center justify-center rounded-button border border-border disabled:opacity-30"><ArrowDown size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedStep ? (
            <div className="min-w-0 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-heading text-accent-hover">E-mail bewerken</p>
                  <h2 className="mt-1 text-heading-md">{selectedStep.name}</h2>
                </div>
                <label className="flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-body-sm font-semibold">
                  <input type="checkbox" checked={selectedStep.enabled} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, enabled: event.target.checked }))} className="h-5 w-5 accent-amber-500" />
                  Mail actief
                </label>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Taal van e-mail">
                {(Object.keys(localeLabels) as Locale[]).map((item) => (
                  <button key={item} type="button" role="tab" aria-selected={locale === item} onClick={() => setLocale(item)} className={`min-h-11 whitespace-nowrap rounded-button px-4 text-body-sm font-semibold ${locale === item ? "bg-contrast text-white" : "border border-border bg-background text-text"}`}>{localeLabels[item]}</button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5">
                <div>
                  <label htmlFor="step-name" className="font-heading text-body-sm font-semibold">Interne naam</label>
                  <input id="step-name" value={selectedStep.name} maxLength={100} onChange={(event) => updateStep(selectedStep.id, (step) => ({ ...step, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="mail-subject" className="font-heading text-body-sm font-semibold">Onderwerp</label>
                  <input id="mail-subject" value={selectedStep.content.locales[locale].subject} maxLength={180} onChange={(event) => updateContent("subject", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="mail-preview" className="font-heading text-body-sm font-semibold">Previewtekst</label>
                  <input id="mail-preview" value={selectedStep.content.locales[locale].previewText} maxLength={255} onChange={(event) => updateContent("previewText", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="mail-heading" className="font-heading text-body-sm font-semibold">Persoonlijke kop</label>
                  <input id="mail-heading" value={selectedStep.content.locales[locale].heading} maxLength={180} onChange={(event) => updateContent("heading", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="mail-body" className="font-heading text-body-sm font-semibold">Bericht</label>
                  <textarea id="mail-body" rows={6} value={selectedStep.content.locales[locale].body} maxLength={4000} onChange={(event) => updateContent("body", event.target.value)} className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 leading-6" />
                </div>
                <div>
                  <label htmlFor="mail-button" className="font-heading text-body-sm font-semibold">Knoptekst</label>
                  <input id="mail-button" value={selectedStep.content.locales[locale].buttonLabel} maxLength={80} onChange={(event) => updateContent("buttonLabel", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
                </div>
              </div>

              <div className="mt-5 rounded-panel border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-heading text-muted">Canvas</p>
                  <button type="button" onClick={addRow} className="inline-flex min-h-9 items-center gap-1 rounded-button border border-border bg-white px-3 text-xs font-semibold"><Plus size={14} />Rij toevoegen</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AFTERSALES_BLOCK_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={!selectedColumnRef.current}
                      onClick={() => selectedColumnRef.current && addBlock(selectedColumnRef.current.rowId, selectedColumnRef.current.columnId, type)}
                      className="inline-flex min-h-9 items-center rounded-button border border-border bg-white px-3 text-xs font-semibold disabled:opacity-40"
                    >
                      {BLOCK_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Selecteer eerst een kolom hieronder, klik dan een bloktype om het toe te voegen.</p>

                <div className="mt-4 space-y-3">
                  {selectedStep.content.canvas.rows.map((row) => (
                    <div key={row.id} className="rounded-button border border-border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted">Rij</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addColumn(row.id)} disabled={row.columns.length >= 4} className="text-xs font-semibold text-accent-hover disabled:opacity-40">Kolom toevoegen</button>
                          <button type="button" onClick={() => removeRow(row.id)} disabled={selectedStep.content.canvas.rows.length <= 1} className="text-xs font-semibold text-red-700 disabled:opacity-40">Rij verwijderen</button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: row.columns.map((column) => `${Math.round(column.widthFraction * 100)}fr`).join(" ") }}>
                        {row.columns.map((column) => (
                          <div
                            key={column.id}
                            onClick={() => (selectedColumnRef.current = { rowId: row.id, columnId: column.id })}
                            className="min-h-[60px] cursor-pointer rounded-button border border-dashed border-border p-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase text-muted">Kolom</span>
                              <button type="button" onClick={(event) => { event.stopPropagation(); removeColumn(row.id, column.id); }} disabled={row.columns.length <= 1} aria-label="Verwijder kolom" className="text-red-700 disabled:opacity-40"><X size={12} /></button>
                            </div>
                            <div className="mt-1 space-y-1">
                              {column.blocks.map((block) => (
                                <button
                                  key={block.id}
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); setSelectedBlockId(block.id); selectedColumnRef.current = { rowId: row.id, columnId: column.id }; }}
                                  className={`flex w-full items-center justify-between gap-1 rounded border px-2 py-1 text-left text-xs ${selectedBlockId === block.id ? "border-accent bg-accent/10" : "border-border bg-background"}`}
                                >
                                  <span>{BLOCK_TYPE_LABELS[block.type]}</span>
                                  <span onClick={(event) => { event.stopPropagation(); removeBlock(row.id, column.id, block.id); }} role="button" aria-label="Verwijder blok" className="text-red-700"><X size={12} /></span>
                                </button>
                              ))}
                              {column.blocks.length === 0 ? <p className="text-[11px] text-muted">Leeg</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-panel border border-border bg-background p-4">
                <p className="text-xs font-bold uppercase tracking-heading text-muted">Personalisatievelden</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AFTERSALES_TOKENS_BY_TRIGGER[selectedStep.trigger].map((token) => <code key={token} className="rounded bg-white px-2 py-1 text-xs text-text">{`{{${token}}}`}</code>)}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div aria-live="polite">
            {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
            {message ? <p role="status" className="text-body-sm font-semibold text-emerald-700">{message}</p> : null}
            {!error && !message ? <p className="text-body-sm text-muted">{dirty ? "Niet-opgeslagen wijzigingen" : "Alle wijzigingen zijn opgeslagen"}</p> : null}
          </div>
          <button type="button" onClick={save} disabled={!dirty || busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-50"><Save size={18} />{busy === "save" ? "Opslaan…" : "Flow opslaan"}</button>
        </div>
      </section>

      {selectedStep ? (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-heading text-accent-hover">Live voorbeeld</p><h2 className="mt-1 text-heading-md">Inboxweergave</h2></div>
              <div className="flex rounded-button border border-border p-1">
                <button type="button" onClick={() => setPreviewMode("desktop")} className={`min-h-9 rounded px-3 text-xs font-semibold ${previewMode === "desktop" ? "bg-contrast text-white" : "text-muted"}`}><Eye size={15} className="mr-1 inline" />Desktop</button>
                <button type="button" onClick={() => setPreviewMode("mobile")} className={`min-h-9 rounded px-3 text-xs font-semibold ${previewMode === "mobile" ? "bg-contrast text-white" : "text-muted"}`}>Mobiel</button>
              </div>
            </div>
            <div className="mt-4 rounded-button border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-heading text-muted">Onderwerp</p>
              <p className="mt-1 font-semibold text-text">{sampleValue(selectedStep.content.locales[locale].subject)}</p>
            </div>
            <div className={`mx-auto mt-4 transition-[max-width] ${previewMode === "mobile" ? "max-w-[360px]" : "max-w-full"}`}>
              <iframe title="Voorbeeld aftersales-e-mail" sandbox="" srcDoc={preview} className="h-[610px] w-full rounded-panel border border-border bg-white" />
            </div>
          </div>

          <aside className="rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6 xl:self-start">
            <div className="flex items-center gap-3"><Send className="text-accent-hover" /><div><p className="text-xs font-bold uppercase tracking-heading text-muted">Providercontrole</p><h2 className="text-heading-md">Testmail</h2></div></div>
            <p className="mt-3 text-body-sm leading-6 text-muted">Verzend de opgeslagen versie met gegevens uit de nieuwste geschikte bestelling naar je eigen adres.</p>
            <label htmlFor="test-email" className="mt-5 block font-heading text-body-sm font-semibold">Testadres</label>
            <input id="test-email" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="test@voorbeeld.nl" className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
            <button type="button" onClick={sendTest} disabled={busy !== null || provider === "none"} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-border bg-background px-4 font-heading text-body-sm font-bold disabled:opacity-50"><Mail size={18} />{busy === "test" ? "Verzenden…" : "Testmail sturen"}</button>
            <div className="mt-5 rounded-button bg-[#f3efe7] p-3 text-xs leading-5 text-muted">Testmails krijgen <strong>[TEST]</strong> in het onderwerp en worden apart als testmail in het maillogboek vastgelegd.</div>
          </aside>
        </section>
      ) : null}

      <section className="rounded-panel border border-border bg-surface shadow-card">
        <div className="flex items-center gap-3 border-b border-border p-5 sm:p-6"><Activity className="text-accent-hover" /><div><p className="text-xs font-bold uppercase tracking-heading text-muted">Controleerbaar</p><h2 className="text-heading-md">Laatste verzendingen</h2></div></div>
        {initialDeliveries.length === 0 ? (
          <div className="px-5 py-10 text-center text-body-sm text-muted">Nog geen aftersales-mails verzonden. De flow is standaard een concept.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-body-sm">
              <thead><tr className="border-b border-border text-left text-muted"><th className="px-5 py-3 font-heading">Status</th><th className="px-5 py-3 font-heading">Mail</th><th className="px-5 py-3 font-heading">Klant</th><th className="px-5 py-3 font-heading">Bestelling</th><th className="px-5 py-3 font-heading">Moment</th></tr></thead>
              <tbody>{initialDeliveries.map((delivery) => (
                <tr key={delivery.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${delivery.status === "SENT" ? "bg-emerald-100 text-emerald-800" : delivery.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{delivery.status === "SENT" ? <CheckCircle2 size={14} /> : <Activity size={14} />}{delivery.status === "SENT" ? "Geaccepteerd" : delivery.status === "FAILED" ? "Mislukt" : "Bezig"}</span>{delivery.errorMessage ? <p className="mt-1 max-w-xs text-xs text-red-700">{delivery.errorMessage}</p> : null}</td>
                  <td className="px-5 py-4"><p className="font-semibold">{delivery.stepName}</p><p className="text-xs text-muted">{delivery.provider ?? "—"}</p></td>
                  <td className="px-5 py-4"><p>{delivery.customerName}</p><p className="text-xs text-muted">{delivery.customerEmail}</p></td>
                  <td className="px-5 py-4"><a href={`/admin/bestellingen/${delivery.orderId}`} className="font-semibold text-accent-hover underline underline-offset-4">{delivery.orderId}</a></td>
                  <td className="whitespace-nowrap px-5 py-4 text-muted">{formatDate(delivery.sentAt ?? delivery.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {mediaPickerFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Kies media">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-panel bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-heading-md">Mediabibliotheek</h2>
              <button type="button" onClick={() => setMediaPickerFor(null)} aria-label="Sluiten" className="flex h-9 w-9 items-center justify-center rounded-button border border-border"><X size={16} /></button>
            </div>
            {mediaLoading ? (
              <p className="mt-4 text-body-sm text-muted">Laden…</p>
            ) : mediaOptions.length === 0 ? (
              <p className="mt-4 text-body-sm text-muted">Nog geen media geüpload. Ga naar Marketing → Mediabibliotheek om afbeeldingen toe te voegen.</p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {mediaOptions.map((asset) => (
                  <button key={asset.id} type="button" onClick={() => pickMedia(asset.url)} className="overflow-hidden rounded-panel border border-border">
                    <img src={asset.url} alt={asset.originalFilename} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
