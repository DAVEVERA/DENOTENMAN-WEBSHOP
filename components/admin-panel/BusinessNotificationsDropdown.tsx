"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";

type Notification = { id: string; summary: string; createdAt: string; companyName: string; href: string; unread: boolean };
type Inbox = { unreadCount: number; events: Notification[] };

export function BusinessNotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch("/api/admin/business-events", { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error();
        const data: Inbox = await response.json();
        if (!Array.isArray(data.events) || typeof data.unreadCount !== "number") throw new Error();
        if (active && !request.signal.aborted) { setInbox(data); setError(null); }
      } catch {
        if (active && !request.signal.aborted) setError("Meldingen laden is niet gelukt. Probeer het opnieuw.");
      }
    }
    void load();
    const interval = window.setInterval(load, 60_000);
    window.addEventListener("business-events-read", load);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); window.removeEventListener("business-events-read", load); };
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function dismiss(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function close() { setOpen(false); buttonRef.current?.focus(); }
  const unreadIds = inbox?.events.filter((event) => event.unread).map((event) => event.id) ?? [];

  return (
    <div ref={rootRef} className="relative" onKeyDown={(event) => {
      if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    }} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <button ref={buttonRef} type="button" aria-label="Zakelijke meldingen" aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-border bg-surface text-text hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <Bell className="h-5 w-5" aria-hidden="true" />
        {(inbox?.unreadCount ?? 0) > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-700 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white"><span className="sr-only">Ongelezen: </span>{inbox!.unreadCount > 99 ? "99+" : inbox!.unreadCount}</span> : null}
      </button>
      {open ? (
        <div ref={panelRef} id={panelId} role="dialog" aria-label="Zakelijke meldingen" tabIndex={-1}
          className="fixed left-4 right-4 top-[4.5rem] z-50 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-card-hover outline-none sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div><h2 className="font-heading text-heading-sm font-bold text-text">Zakelijke meldingen</h2><p className="text-body-sm text-muted">{inbox ? `${inbox.unreadCount} ongelezen` : "Meldingen ophalen…"}</p></div>
            <button type="button" onClick={close} aria-label="Meldingen sluiten" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button hover:bg-background"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          {error ? <div className="px-4 py-3"><p role="alert" className="text-body-sm text-red-700">{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)} className="min-h-11 text-body-sm font-bold underline">Opnieuw proberen</button></div> : null}
          {!inbox && !error ? <p role="status" className="p-4 text-body-sm text-muted">Meldingen laden…</p> : null}
          {inbox?.events.length === 0 ? <p className="p-4 text-body-sm text-muted">Er zijn nog geen zakelijke meldingen.</p> : null}
          {inbox && inbox.events.length > 0 ? <ul className="min-h-0 overflow-y-auto overscroll-contain divide-y divide-border">
            {inbox.events.map((event) => <li key={event.id}>
              <Link href={event.href} prefetch={false} onClick={() => setOpen(false)} className={`block min-h-11 px-4 py-3 hover:bg-background focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent ${event.unread ? "bg-accent/5" : ""}`}>
                <p className="break-words text-body-sm font-bold text-text">{event.companyName}{event.unread ? <span className="ml-2 text-xs text-accent-ink">Nieuw</span> : null}</p>
                <p className="mt-1 break-words text-body-sm text-text">{event.summary}</p>
                <time dateTime={event.createdAt} className="mt-1 block text-xs text-muted">{new Date(event.createdAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
              </Link>
            </li>)}
          </ul> : null}
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-border px-4 py-2">
            <Link href="/admin/zakelijk#meldingen" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center text-body-sm font-bold text-accent-ink underline underline-offset-4">Alle meldingen</Link>
            {unreadIds.length > 0 ? <button type="button" disabled={busy} className="min-h-11 text-body-sm font-semibold text-text disabled:opacity-60" onClick={async () => {
              setBusy(true); setError(null);
              try {
                const response = await fetch("/api/admin/business-events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventIds: unreadIds }) });
                if (!response.ok) throw new Error();
                panelRef.current?.focus();
                window.dispatchEvent(new Event("business-events-read"));
              } catch { setError("Als gelezen markeren is niet gelukt. Probeer het opnieuw."); }
              finally { setBusy(false); }
            }}>{busy ? "Bijwerken…" : "Getoonde gelezen"}</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
