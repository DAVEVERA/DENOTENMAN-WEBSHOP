"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  countContacts,
  DEFAULT_CONTACT_FILTER,
  filterContacts,
  sortContacts,
  type Contact,
  type ContactFilter,
  type ContactSortKey,
} from "@/lib/marketing/contacts-core";

const PAGE = 200;

const COUNTRY_LABELS: Record<string, string> = { NL: "Nederland", BE: "België", OTHER: "Ander land", UNKNOWN: "Onbekend" };
const STATUS_LABELS: Record<Contact["status"], string> = {
  subscribed: "Ingeschreven",
  unsubscribed: "Afgemeld",
  pending: "Wacht op bevestiging",
  cleaned: "Onbestelbaar",
  transactional: "Alleen transactioneel",
  archived: "Gearchiveerd",
};

const COLUMNS: Array<{ key: ContactSortKey; label: string }> = [
  { key: "email", label: "E-mailadres" },
  { key: "name", label: "Naam" },
  { key: "city", label: "Plaats" },
  { key: "country", label: "Land" },
  { key: "type", label: "Type" },
];

function csvCell(value: string): string {
  return /[";\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

function downloadCsv(rows: Contact[]) {
  const header = ["E-mailadres", "Naam", "Bedrijf", "Plaats", "Land", "Bron land", "Type", "Status"];
  const lines = rows.map((contact) =>
    [contact.email, contact.name, contact.company ?? "", contact.city ?? "", contact.country ?? "", contact.countrySource ?? "", contact.type, STATUS_LABELS[contact.status]]
      .map(csvCell)
      .join(";"),
  );
  // BOM + semicolons so Excel with Dutch settings opens it in columns with accents intact.
  const blob = new Blob([`﻿${[header.join(";"), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `e-mailadressen-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<ContactFilter>(DEFAULT_CONTACT_FILTER);
  const [sort, setSort] = useState<{ key: ContactSortKey; direction: "asc" | "desc" }>({ key: "email", direction: "asc" });
  const [visible, setVisible] = useState(PAGE);
  const [busy, setBusy] = useState<"newsletter" | "sync" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const counts = useMemo(() => countContacts(contacts), [contacts]);
  const rows = useMemo(() => sortContacts(filterContacts(contacts, filter), sort.key, sort.direction), [contacts, filter, sort]);

  function patch(next: Partial<ContactFilter>) {
    setFilter((current) => ({ ...current, ...next }));
    setVisible(PAGE);
  }

  function toggleSort(key: ContactSortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  }

  // Only a country of NL/BE (or none) and a type can be sent; search and status are list-only.
  const transferableCountry = filter.country === null || filter.country === "NL" || filter.country === "BE";

  async function syncTags(): Promise<boolean> {
    const response = await fetch("/api/admin/marketing/contacts/sync-tags", { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage({ tone: "error", text: body.message ?? "De tags konden niet in Mailchimp worden bijgewerkt." });
      return false;
    }
    const body = (await response.json()) as { countries: Array<{ country: string; added: number; removed: number; errors: number }> };
    const errors = body.countries.reduce((sum, row) => sum + row.errors, 0);
    setMessage({
      tone: errors ? "error" : "ok",
      text: `Tags bijgewerkt: ${body.countries.map((row) => `Land ${row.country} +${row.added}/−${row.removed}`).join(", ")}${errors ? ` (${errors} adressen weigerde Mailchimp)` : ""}.`,
    });
    return true;
  }

  async function run(kind: "newsletter" | "sync") {
    setBusy(kind);
    setMessage(null);
    try {
      if (!(await syncTags()) || kind === "sync") return;
      const params = new URLSearchParams();
      if (filter.country === "NL" || filter.country === "BE") params.set("land", filter.country);
      if (filter.type) params.set("type", filter.type);
      router.push(`/admin/marketing/nieuwsbrieven/nieuw${params.size ? `?${params}` : ""}`);
    } catch {
      setMessage({ tone: "error", text: "Er ging iets mis door een netwerkfout. Probeer het opnieuw." });
    } finally {
      setBusy(null);
    }
  }

  const select = "mt-1 min-h-11 w-full rounded-button border border-border bg-background px-3";

  return (
    <div>
      <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-5">
        {counts.groups.map((group) => {
          const active = filter.country === group.country && filter.type === group.type;
          return (
            <button
              key={`${group.country}-${group.type}`}
              type="button"
              onClick={() => patch(active ? { country: null, type: null } : { country: group.country, type: group.type, status: "subscribed" })}
              className={`rounded-panel border p-4 text-left ${active ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
              aria-pressed={active}
            >
              <p className="text-xs font-bold uppercase tracking-heading text-muted">
                {COUNTRY_LABELS[group.country]} · {group.type}
              </p>
              <p className="mt-1 font-heading text-heading-lg text-text">{group.count}</p>
            </button>
          );
        })}
        <div className="rounded-panel border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-heading text-muted">Ingeschreven totaal</p>
          <p className="mt-1 font-heading text-heading-lg text-text">{counts.subscribed}</p>
          <p className="mt-1 text-xs text-muted">{counts.unknownCountry} zonder bekend land</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 rounded-panel border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-body-sm font-semibold">
          Land
          <select value={filter.country ?? ""} onChange={(event) => patch({ country: (event.target.value || null) as ContactFilter["country"] })} className={select}>
            <option value="">Alle landen</option>
            <option value="NL">Nederland</option>
            <option value="BE">België</option>
            <option value="OTHER">Ander land</option>
            <option value="UNKNOWN">Onbekend</option>
          </select>
        </label>
        <label className="text-body-sm font-semibold">
          Type klant
          <select value={filter.type ?? ""} onChange={(event) => patch({ type: (event.target.value || null) as ContactFilter["type"] })} className={select}>
            <option value="">Particulier en zakelijk</option>
            <option value="particulier">Particulier</option>
            <option value="zakelijk">Zakelijk</option>
          </select>
        </label>
        <label className="text-body-sm font-semibold">
          Status
          <select value={filter.status} onChange={(event) => patch({ status: event.target.value as ContactFilter["status"] })} className={select}>
            <option value="subscribed">Ingeschreven</option>
            <option value="all">Alle statussen</option>
            <option value="pending">Wacht op bevestiging</option>
            <option value="unsubscribed">Afgemeld</option>
            <option value="cleaned">Onbestelbaar</option>
          </select>
        </label>
        <label className="text-body-sm font-semibold">
          Zoeken
          <input type="search" value={filter.query} onChange={(event) => patch({ query: event.target.value })} placeholder="Adres, naam, bedrijf of plaats" className={select} />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => run("newsletter")}
          disabled={busy !== null || !transferableCountry}
          className="min-h-11 rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast shadow-button disabled:opacity-60"
        >
          {busy === "newsletter" ? "Tags bijwerken…" : "Nieuwsbrief maken voor deze selectie"}
        </button>
        <button
          type="button"
          onClick={() => run("sync")}
          disabled={busy !== null}
          className="min-h-11 rounded-button border border-border bg-background px-4 text-body-sm font-semibold disabled:opacity-60"
        >
          {busy === "sync" ? "Bezig…" : "Land- en zakelijk-tags bijwerken"}
        </button>
        <button
          type="button"
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
          className="min-h-11 rounded-button border border-border bg-background px-4 text-body-sm font-semibold disabled:opacity-60"
        >
          CSV downloaden ({rows.length})
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        {transferableCountry
          ? "De nieuwsbrief gaat naar de ingeschreven adressen met dit land en type. Zoeken en status gelden alleen voor deze lijst."
          : "Alleen Nederland, België of alle landen kunnen naar de nieuwsbrief worden overgenomen."}
      </p>
      {message ? (
        <p className={`mt-2 text-body-sm ${message.tone === "ok" ? "text-accent-hover" : "text-red-700"}`} role="status">{message.text}</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-panel border border-border bg-surface px-5 py-10 text-center text-body-sm text-muted">
          Geen e-mailadressen voor deze filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-body-sm">
            <thead className="border-b border-border text-xs uppercase tracking-heading text-muted">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-4 py-3"
                    aria-sort={sort.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 font-bold uppercase">
                      {column.label}
                      <span aria-hidden>{sort.key === column.key ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visible).map((contact) => (
                <tr key={contact.email} className="border-b border-border last:border-0">
                  <td className="break-all px-4 py-3 text-text">{contact.email}</td>
                  <td className="px-4 py-3">
                    {contact.name || "—"}
                    {contact.company ? <span className="block text-xs text-muted">{contact.company}</span> : null}
                  </td>
                  <td className="px-4 py-3">{contact.city ?? "—"}</td>
                  <td className="px-4 py-3" title={contact.countrySource ? `Bron: ${contact.countrySource}` : undefined}>
                    {contact.country ? COUNTRY_LABELS[contact.country] : "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{contact.type}</td>
                  <td className="px-4 py-3 text-muted">{STATUS_LABELS[contact.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > visible ? (
            <div className="border-t border-border p-3 text-center">
              <button type="button" onClick={() => setVisible((current) => current + PAGE)} className="min-h-11 rounded-button border border-border bg-background px-4 text-body-sm font-semibold">
                Meer tonen ({rows.length - visible} over)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
