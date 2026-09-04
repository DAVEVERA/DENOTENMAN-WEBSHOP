"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaPickerButton } from "@/components/admin-panel/MediaPickerButton";
import { buildGridBlockHtml, buildTableBlockHtml } from "@/lib/mailchimp/blocks";
import { InsertGridDialog, type GridItemDraft } from "./InsertGridDialog";
import { InsertTableDialog } from "./InsertTableDialog";

type NewsletterDraft = {
  subject: string;
  previewText: string;
  title: string;
  fromName: string;
  replyTo: string;
  contentHtml: string;
};

type ApiError = {
  error?: string;
  message?: string;
  fieldErrors?: Array<{ field: string; message: string }>;
};

type NewsletterEditorFormProps = {
  mode: "create" | "edit";
  initial: NewsletterDraft;
  recipientCount: number;
  campaignId?: string;
  campaignStatus?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function previewDocument(draft: NewsletterDraft): string {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHtml(draft.subject)}</title></head><body style="margin:0;background:#f6f3ee;color:#333;font-family:Arial,sans-serif"><div style="display:none">${escapeHtml(draft.previewText)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:18px 10px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e4dfd5;border-radius:14px;overflow:hidden"><tr><td style="background:#e0b200;color:#141414;padding:22px 28px;font-size:24px;font-weight:700">De Notenman</td></tr><tr><td style="padding:28px;font-size:16px;line-height:1.65">${draft.contentHtml}</td></tr><tr><td style="padding:20px 28px;background:#f6f3ee;color:#6e675c;font-size:12px">Afzenderadres · Afmelden voor de nieuwsbrief</td></tr></table></td></tr></table></body></html>`;
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  if (body?.fieldErrors?.[0]?.message) return body.fieldErrors[0].message;
  if (body?.message) return body.message;
  if (body?.error === "CONFIRMATION_REQUIRED") return "Bevestig deze onomkeerbare actie.";
  return "De actie is niet uitgevoerd. Probeer opnieuw.";
}

export function NewsletterEditorForm({
  mode,
  initial,
  recipientCount,
  campaignId,
  campaignStatus = "save",
}: NewsletterEditorFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [gridDialogOpen, setGridDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const editable = mode === "create" || campaignStatus === "save";
  const preview = useMemo(() => previewDocument(draft), [draft]);

  function update(field: keyof NewsletterDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage(null);
  }

  function insertHtml(html: string) {
    const textarea = contentRef.current;
    const current = draft.contentHtml;
    if (!textarea) {
      update("contentHtml", `${current}${html}`);
      return;
    }
    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    update("contentHtml", `${current.slice(0, start)}${html}${current.slice(end)}`);
  }

  function insertImage(url: string) {
    const tag = `<img src="${url}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border-radius:8px" />`;
    insertHtml(tag);
  }

  function insertGrid(items: GridItemDraft[]) {
    const html = buildGridBlockHtml(items);
    if (html) insertHtml(html);
    setGridDialogOpen(false);
  }

  function insertTable(headers: string[], rows: string[][]) {
    const html = buildTableBlockHtml(headers, rows);
    if (html) insertHtml(html);
    setTableDialogOpen(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    setMessage(null);

    const endpoint =
      mode === "create"
        ? "/api/admin/marketing/newsletters"
        : `/api/admin/marketing/newsletters/${campaignId}`;
    try {
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const body = (await response.json()) as { campaign?: { id?: string } };
      setDirty(false);
      if (mode === "create" && body.campaign?.id) {
        router.push(`/admin/marketing/nieuwsbrieven/${body.campaign.id}`);
        return;
      }
      setMessage("Wijzigingen opgeslagen in Mailchimp.");
      router.refresh();
    } catch {
      setError("Opslaan mislukt door een netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  function requireSaved(): boolean {
    if (!dirty) return true;
    setError("Sla de wijzigingen eerst op voordat je deze actie uitvoert.");
    return false;
  }

  async function postAction(action: "test" | "schedule" | "send", body: object) {
    if (!campaignId || !requireSaved()) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/marketing/newsletters/${campaignId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      setMessage(
        action === "test"
          ? "Testmail aangevraagd."
          : action === "schedule"
            ? "Nieuwsbrief ingepland."
            : "Nieuwsbrief wordt verzonden."
      );
      router.refresh();
    } catch {
      setError("De actie mislukte door een netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!testEmail.trim()) {
      setError("Vul een geldig testadres in.");
      return;
    }
    await postAction("test", { email: testEmail.trim() });
  }

  async function schedule() {
    if (!scheduleTime) {
      setError("Kies een verzendmoment.");
      return;
    }
    if (!window.confirm(`Deze nieuwsbrief inplannen voor ${scheduleTime}?`)) return;
    await postAction("schedule", {
      scheduleTime: new Date(scheduleTime).toISOString(),
      confirm: true,
    });
  }

  async function send() {
    if (
      !window.confirm(
        `Nu definitief versturen naar ${recipientCount} ontvangers? Dit kan niet ongedaan worden gemaakt.`
      )
    ) {
      return;
    }
    await postAction("send", { confirm: true });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
      <form onSubmit={save} className="rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
        <fieldset disabled={!editable || busy !== null} className="space-y-5 disabled:opacity-70">
          <legend className="font-heading text-heading-md text-text">
            {editable ? "Campagne-inhoud" : "Verzonden inhoud"}
          </legend>

          <div>
            <label htmlFor="newsletter-title" className="font-heading text-body-sm font-semibold text-text">
              Interne campagnenaam
            </label>
            <input id="newsletter-title" required maxLength={150} value={draft.title} onChange={(event) => update("title", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
          </div>

          <div>
            <label htmlFor="newsletter-subject" className="font-heading text-body-sm font-semibold text-text">Onderwerp</label>
            <input id="newsletter-subject" required maxLength={150} value={draft.subject} onChange={(event) => update("subject", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
          </div>

          <div>
            <label htmlFor="newsletter-preview" className="font-heading text-body-sm font-semibold text-text">Previewtekst</label>
            <input id="newsletter-preview" maxLength={255} value={draft.previewText} onChange={(event) => update("previewText", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="newsletter-from" className="font-heading text-body-sm font-semibold text-text">Afzendernaam</label>
              <input id="newsletter-from" required maxLength={100} value={draft.fromName} onChange={(event) => update("fromName", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
            </div>
            <div>
              <label htmlFor="newsletter-reply" className="font-heading text-body-sm font-semibold text-text">Antwoordadres</label>
              <input id="newsletter-reply" type="email" required value={draft.replyTo} onChange={(event) => update("replyTo", event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3 py-2" />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="newsletter-content" className="font-heading text-body-sm font-semibold text-text">Inhoud (veilige HTML)</label>
              <div className="flex flex-wrap gap-2">
                <MediaPickerButton onSelect={insertImage} label="Afbeelding invoegen" />
                <button
                  type="button"
                  onClick={() => setGridDialogOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold"
                >
                  Grid toevoegen
                </button>
                <button
                  type="button"
                  onClick={() => setTableDialogOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-button border border-border bg-background px-3 text-xs font-semibold"
                >
                  Tabel toevoegen
                </button>
              </div>
            </div>
            <textarea ref={contentRef} id="newsletter-content" required rows={16} maxLength={100000} value={draft.contentHtml} onChange={(event) => update("contentHtml", event.target.value)} className="mt-1 w-full rounded-button border border-border bg-background px-3 py-2 font-mono text-body-sm" />
            <p className="mt-1 text-xs text-muted">Scripts, trackingcode en onveilige links worden vóór opslag verwijderd.</p>
          </div>
        </fieldset>

        {error ? <p role="alert" className="mt-4 text-body-sm font-semibold text-red-700">{error}</p> : null}
        {message ? <p role="status" className="mt-4 text-body-sm font-semibold text-accent-hover">{message}</p> : null}

        {editable ? (
          <button type="submit" disabled={busy !== null} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60">
            {busy === "save" ? "Opslaan…" : mode === "create" ? "Concept maken" : "Wijzigingen opslaan"}
          </button>
        ) : null}

        {mode === "edit" && editable ? (
          <section className="mt-8 border-t border-border pt-6" aria-label="Verzenden">
            <div className="rounded-panel border border-accent/40 bg-accent/10 p-4">
              <p className="font-heading text-body-sm font-bold text-text">Verzendcontrole · {recipientCount} ontvangers</p>
              <p className="mt-1 text-xs text-muted">Test eerst. Definitief versturen kan niet ongedaan worden gemaakt.</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="test@voorbeeld.nl" aria-label="Testmailadres" className="min-h-11 rounded-button border border-border bg-background px-3 py-2" />
              <button type="button" onClick={sendTest} disabled={busy !== null} className="min-h-11 rounded-button border border-border px-4 font-heading text-body-sm font-semibold">Testmail sturen</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
              <input type="datetime-local" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} aria-label="Verzendmoment" className="min-h-11 rounded-button border border-border bg-background px-3 py-2" />
              <button type="button" onClick={schedule} disabled={busy !== null} className="min-h-11 rounded-button border border-border px-4 font-heading text-body-sm font-semibold">Inplannen</button>
              <button type="button" onClick={send} disabled={busy !== null} className="min-h-11 rounded-button bg-red-700 px-4 font-heading text-body-sm font-bold text-white disabled:opacity-60">Nu versturen</button>
            </div>
          </section>
        ) : null}
      </form>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start" aria-label="Nieuwsbriefvoorbeeld">
        <div>
          <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent-hover">Voorbeeld</p>
          <h2 className="mt-1 text-heading-md text-text">Desktop en mobiel</h2>
        </div>
        <div className="rounded-panel border border-border bg-surface p-3 shadow-card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-heading text-muted">Desktop</p>
          <iframe title="Desktopvoorbeeld nieuwsbrief" sandbox="" srcDoc={preview} className="h-[520px] w-full rounded-button border border-border bg-white" />
        </div>
        <div className="mx-auto max-w-[350px] rounded-[28px] border-8 border-contrast bg-surface p-2 shadow-card">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-heading text-muted">Mobiel</p>
          <iframe title="Mobiel voorbeeld nieuwsbrief" sandbox="" srcDoc={preview} className="h-[520px] w-full rounded-[18px] border border-border bg-white" />
        </div>
      </aside>

      <InsertGridDialog open={gridDialogOpen} onClose={() => setGridDialogOpen(false)} onInsert={insertGrid} />
      <InsertTableDialog open={tableDialogOpen} onClose={() => setTableDialogOpen(false)} onInsert={insertTable} />
    </div>
  );
}
