"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarPlus, Megaphone, Pencil, Plug, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { SocialPlatformName } from "@/lib/social/platforms";
import type { SocialAccountDto, SocialCampaignDto, SocialPostDto } from "@/lib/social/service";
import { PlatformIcon } from "./PlatformIcon";
import { SocialComposer } from "./SocialComposer";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export type OtherCalendarEvent = { id: string; type: "actie" | "banner" | "nieuwsbrief"; label: string; title: string; at: string; href: string };

const otherStyles: Record<OtherCalendarEvent["type"], string> = {
  actie: "bg-accent/15 text-accent-ink",
  banner: "bg-blue-100 text-blue-800",
  nieuwsbrief: "bg-purple-100 text-purple-800",
};
const otherLabels: Record<OtherCalendarEvent["type"], string> = { actie: "Kortingsactie", banner: "Banner", nieuwsbrief: "Nieuwsbrief" };

const postStatus: Record<string, { label: string; dot: string }> = {
  DRAFT: { label: "Concept", dot: "bg-muted" },
  SCHEDULED: { label: "Ingepland", dot: "bg-amber-500" },
  PUBLISHING: { label: "Bezig", dot: "bg-amber-500" },
  PUBLISHED: { label: "Geplaatst", dot: "bg-green-600" },
  PARTIAL: { label: "Deels geplaatst", dot: "bg-orange-500" },
  FAILED: { label: "Mislukt", dot: "bg-red-600" },
};

const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const monthLabel = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" });
const timeLabel = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthParam(year: number, month: number) {
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function gridDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(year, month + 1, 0);
  const end = new Date(year, month, last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) days.push(new Date(cursor));
  return days;
}

function postDate(post: SocialPostDto): Date | null {
  const iso = post.scheduledAt ?? post.publishedAt;
  return iso ? new Date(iso) : null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function campaignCovers(campaign: SocialCampaignDto, day: Date) {
  if (!campaign.startsAt) return false;
  const start = startOfDay(new Date(campaign.startsAt));
  const end = startOfDay(new Date(campaign.endsAt ?? campaign.startsAt));
  return day >= start && day <= end;
}

function localDefault(day: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T10:00`;
}

function dateInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------- Campaigns ----------

function CampaignPanel({ campaigns, canWrite, onChange }: { campaigns: SocialCampaignDto[]; canWrite: boolean; onChange: (campaigns: SocialCampaignDto[]) => void }) {
  const [editing, setEditing] = useState<{ id: string | null; name: string; description: string; color: string; startsAt: string; endsAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(editing.id ? `/api/admin/social/campaigns/${encodeURIComponent(editing.id)}` : "/api/admin/social/campaigns", {
        method: editing.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description.trim() || null,
          color: editing.color,
          startsAt: editing.startsAt ? new Date(`${editing.startsAt}T00:00:00`).toISOString() : null,
          endsAt: editing.endsAt ? new Date(`${editing.endsAt}T23:59:00`).toISOString() : null,
        }),
      });
      const body = await response.json().catch(() => ({})) as { campaign?: SocialCampaignDto; message?: string };
      if (!response.ok || !body.campaign) throw new Error(body.message || "Opslaan mislukt.");
      const saved = body.campaign;
      onChange(editing.id ? campaigns.map((item) => item.id === saved.id ? saved : item) : [saved, ...campaigns]);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(campaign: SocialCampaignDto) {
    if (!window.confirm(`Campagne "${campaign.name}" verwijderen? De berichten blijven bestaan.`)) return;
    const response = await fetch(`/api/admin/social/campaigns/${encodeURIComponent(campaign.id)}`, { method: "DELETE" });
    if (response.ok) onChange(campaigns.filter((item) => item.id !== campaign.id));
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card" aria-labelledby="campaigns-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="campaigns-title" className="flex items-center gap-2 font-heading text-body-md font-bold text-text"><Megaphone className="h-4 w-4" aria-hidden="true" />Campagnes</h2>
        {canWrite && !editing ? <button type="button" onClick={() => setEditing({ id: null, name: "", description: "", color: "#B7791F", startsAt: "", endsAt: "" })} className={`${buttonClass} border border-border bg-surface px-3 text-text`}><Plus className="h-4 w-4" aria-hidden="true" />Nieuw</button> : null}
      </div>
      {editing ? (
        <div className="mt-3 grid gap-2">
          <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="Naam, bijv. Sinterklaas" aria-label="Naam campagne" maxLength={120} className={inputClass} />
          <textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Doel of korte omschrijving (optioneel)" aria-label="Omschrijving" rows={2} maxLength={2000} className={`${inputClass} py-2`} />
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold text-muted">Van<input type="date" value={editing.startsAt} onChange={(event) => setEditing({ ...editing, startsAt: event.target.value })} className={inputClass} /></label>
            <label className="grid gap-1 text-xs font-semibold text-muted">Tot en met<input type="date" value={editing.endsAt} onChange={(event) => setEditing({ ...editing, endsAt: event.target.value })} className={inputClass} /></label>
          </div>
          <label className="flex items-center gap-2 text-body-sm font-semibold text-text">Kleur<input type="color" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} className="h-11 w-16 rounded-button border border-border bg-surface" /></label>
          {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !editing.name.trim()} onClick={() => void save()} className={`${buttonClass} bg-accent-ink text-surface`}><Save className="h-4 w-4" aria-hidden="true" />Opslaan</button>
            <button type="button" onClick={() => setEditing(null)} className={`${buttonClass} border border-border bg-surface text-text`}>Annuleren</button>
          </div>
        </div>
      ) : null}
      <ul className="mt-3 grid gap-2">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="flex items-center gap-2 text-body-sm">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: campaign.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-text">{campaign.name}</span>
              <span className="block text-xs text-muted">{campaign.startsAt ? `${shortDate.format(new Date(campaign.startsAt))}${campaign.endsAt ? ` t/m ${shortDate.format(new Date(campaign.endsAt))}` : ""}` : "Geen periode"} · {campaign.postCount} {campaign.postCount === 1 ? "bericht" : "berichten"}</span>
            </span>
            {canWrite ? (
              <>
                <button type="button" onClick={() => setEditing({ id: campaign.id, name: campaign.name, description: campaign.description ?? "", color: campaign.color, startsAt: dateInput(campaign.startsAt), endsAt: dateInput(campaign.endsAt) })} aria-label={`${campaign.name} bewerken`} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => void remove(campaign)} aria-label={`${campaign.name} verwijderen`} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </>
            ) : null}
          </li>
        ))}
        {!campaigns.length && !editing ? <li className="text-body-sm text-muted">Nog geen campagnes. Bundel berichten rond een thema of periode.</li> : null}
      </ul>
    </section>
  );
}

// ---------- Calendar ----------

export function MarketingCalendar({ year, month, initialPosts, accounts, initialCampaigns, otherEvents, canWrite, newslettersUnavailable }: {
  year: number;
  month: number;
  initialPosts: SocialPostDto[];
  accounts: SocialAccountDto[];
  initialCampaigns: SocialCampaignDto[];
  otherEvents: OtherCalendarEvent[];
  canWrite: boolean;
  newslettersUnavailable: boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  // Fresh server data after router.refresh() replaces the local copies.
  const [source, setSource] = useState({ initialPosts, initialCampaigns });
  if (source.initialPosts !== initialPosts || source.initialCampaigns !== initialCampaigns) {
    setSource({ initialPosts, initialCampaigns });
    setPosts(initialPosts);
    setCampaigns(initialCampaigns);
  }
  const [composer, setComposer] = useState<{ post: SocialPostDto | null; defaultScheduledAt?: string } | null>(null);
  const [platformFilter, setPlatformFilter] = useState<SocialPlatformName | "ALL">("ALL");
  const [showOther, setShowOther] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const days = useMemo(() => gridDays(year, month), [year, month]);
  const today = dayKey(new Date());
  const visiblePosts = posts.filter((post) => platformFilter === "ALL" || post.targets.some((target) => target.platform === platformFilter));
  const byDay = useMemo(() => {
    const map = new Map<string, SocialPostDto[]>();
    for (const post of visiblePosts) {
      const date = postDate(post);
      if (!date) continue;
      const key = dayKey(date);
      map.set(key, [...(map.get(key) ?? []), post].sort((a, b) => (postDate(a)?.getTime() ?? 0) - (postDate(b)?.getTime() ?? 0)));
    }
    return map;
  }, [visiblePosts]);
  const otherByDay = useMemo(() => {
    const map = new Map<string, OtherCalendarEvent[]>();
    for (const event of otherEvents) {
      const key = dayKey(new Date(event.at));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [otherEvents]);
  const unplanned = visiblePosts.filter((post) => !postDate(post));
  const monthDays = days.filter((day) => day.getMonth() === month);
  const connectedPlatforms = [...new Set(accounts.filter((account) => account.status === "CONNECTED").map((account) => account.platform))];

  function onSaved(saved: SocialPostDto | null, text: string) {
    if (saved) {
      setPosts((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setComposer((current) => current && current.post?.id === saved.id && ["PUBLISHED", "PARTIAL", "FAILED"].includes(saved.status) ? { post: saved } : null);
    } else {
      setComposer(null);
    }
    setMessage(text);
    router.refresh();
  }

  function PostChip({ post }: { post: SocialPostDto }) {
    const status = postStatus[post.status] ?? postStatus.DRAFT;
    const date = postDate(post);
    return (
      <button
        type="button"
        onClick={() => setComposer({ post })}
        className="flex w-full min-w-0 items-center gap-1 rounded-button border border-border bg-surface px-1.5 py-1 text-left text-xs font-semibold text-text hover:border-border-hover"
        style={post.campaign ? { borderLeft: `4px solid ${post.campaign.color}` } : undefined}
        title={`${status.label} · ${post.title}`}
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
            {date ? <span className="shrink-0 text-muted">{timeLabel.format(date)}</span> : null}
            <span className="ml-auto flex shrink-0 gap-0.5">{[...new Set(post.targets.map((target) => target.platform))].map((platform) => <PlatformIcon key={platform} platform={platform} size="xs" />)}</span>
          </span>
          <span className="truncate">{post.title}</span>
        </span>
        <span className="sr-only">, {status.label}</span>
      </button>
    );
  }

  function DayItems({ day, compact }: { day: Date; compact: boolean }) {
    const key = dayKey(day);
    const dayPosts = byDay.get(key) ?? [];
    const dayOther = showOther ? otherByDay.get(key) ?? [] : [];
    const dayCampaigns = campaigns.filter((campaign) => campaignCovers(campaign, day));
    const limit = compact ? 3 : 50;
    const items = [...dayPosts.map((post) => ({ kind: "post" as const, post })), ...dayOther.map((event) => ({ kind: "other" as const, event }))];
    return (
      <div className="grid gap-1">
        {dayCampaigns.length && compact ? (
          <div className="flex gap-0.5" aria-label={`Campagnes: ${dayCampaigns.map((campaign) => campaign.name).join(", ")}`}>
            {dayCampaigns.map((campaign) => <span key={campaign.id} title={campaign.name} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: campaign.color }} />)}
          </div>
        ) : null}
        {dayCampaigns.length && !compact ? (
          <div className="flex flex-wrap gap-1">
            {dayCampaigns.map((campaign) => <span key={campaign.id} className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-text"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: campaign.color }} aria-hidden="true" />{campaign.name}</span>)}
          </div>
        ) : null}
        {items.slice(0, limit).map((item) => item.kind === "post" ? (
          <PostChip key={item.post.id} post={item.post} />
        ) : (
          <Link key={item.event.id} href={item.event.href} title={`${otherLabels[item.event.type]} · ${item.event.label}`} className={`block truncate rounded-button px-1.5 py-1 text-xs font-semibold ${otherStyles[item.event.type]}`}>{item.event.title}</Link>
        ))}
        {items.length > limit ? <p className="text-xs text-muted">+{items.length - limit} meer</p> : null}
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/marketing" className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-accent-ink underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Marketing</Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-text sm:text-heading-xl">Marketingkalender</h1>
          <p className="mt-1 text-body-sm text-muted">Plan social posts en campagnes voor Facebook, Instagram, TikTok en YouTube. Acties, banners en nieuwsbrieven staan er ook in.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/marketing/social/kanalen" className={`${buttonClass} border border-border bg-surface text-text`}><Plug className="h-4 w-4" aria-hidden="true" />Kanalen</Link>
          {canWrite ? <button type="button" onClick={() => setComposer({ post: null })} className={`${buttonClass} bg-accent text-contrast`}><CalendarPlus className="h-4 w-4" aria-hidden="true" />Nieuw bericht</button> : null}
        </div>
      </div>

      {!connectedPlatforms.length ? (
        <p className="mt-4 rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm text-amber-900">Nog geen kanaal gekoppeld. <Link href="/admin/marketing/social/kanalen" className="font-semibold underline underline-offset-4">Koppel je accounts</Link> om berichten te kunnen plaatsen; concepten kun je nu al maken.</p>
      ) : null}
      {newslettersUnavailable ? <p className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm text-red-800">Mailchimp-nieuwsbrieven konden niet worden geladen. De rest van de kalender werkt wel.</p> : null}
      {message ? <p role="status" className="mt-4 flex items-center justify-between gap-2 rounded-card border border-green-200 bg-green-50 p-3 text-body-sm font-semibold text-green-800">{message}<button type="button" onClick={() => setMessage(null)} aria-label="Melding sluiten" className="inline-flex h-11 w-11 items-center justify-center"><X className="h-4 w-4" aria-hidden="true" /></button></p> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/admin/marketing/kalender?month=${monthParam(year, month - 1)}`} aria-label="Vorige maand" className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Link>
          <p className="min-w-40 text-center font-heading text-body-md font-bold capitalize text-text">{monthLabel.format(new Date(year, month, 1))}</p>
          <Link href={`/admin/marketing/kalender?month=${monthParam(year, month + 1)}`} aria-label="Volgende maand" className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface"><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          <Link href="/admin/marketing/kalender" className="hidden min-h-11 items-center px-2 text-body-sm font-semibold text-accent-ink underline-offset-4 hover:underline sm:inline-flex">Vandaag</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as SocialPlatformName | "ALL")} aria-label="Filter op kanaal" className={`${inputClass} w-auto`}>
            <option value="ALL">Alle kanalen</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
          </select>
          <label className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-text"><input type="checkbox" checked={showOther} onChange={(event) => setShowOther(event.target.checked)} />Acties, banners en nieuwsbrieven</label>
        </div>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          {/* Month grid from tablet width up. */}
          <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-panel border border-border bg-border text-body-sm md:grid">
            {WEEKDAYS.map((label) => <div key={label} className="bg-surface px-2 py-2 text-center text-xs font-semibold uppercase tracking-heading text-muted">{label}</div>)}
            {days.map((day) => {
              const key = dayKey(day);
              return (
                <div key={key} className={`group min-h-[7.5rem] bg-surface p-1.5 ${day.getMonth() === month ? "" : "bg-background opacity-60"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${key === today ? "bg-accent-ink text-surface" : "text-muted"}`}>{day.getDate()}</span>
                    {canWrite ? <button type="button" onClick={() => setComposer({ post: null, defaultScheduledAt: localDefault(day) })} aria-label={`Bericht plannen op ${dayLabel.format(day)}`} className="inline-flex h-7 w-7 items-center justify-center rounded-button text-muted opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"><Plus className="h-4 w-4" aria-hidden="true" /></button> : null}
                  </div>
                  <DayItems day={day} compact />
                </div>
              );
            })}
          </div>

          {/* Day list on phones. */}
          <ol className="grid gap-2 md:hidden">
            {monthDays.map((day) => {
              const key = dayKey(day);
              const campaignStarts = campaigns.some((campaign) => campaign.startsAt && dayKey(new Date(campaign.startsAt)) === key);
              const hasItems = (byDay.get(key)?.length ?? 0) + (showOther ? otherByDay.get(key)?.length ?? 0 : 0) > 0 || campaignStarts;
              if (!hasItems && key !== today) return null;
              return (
                <li key={key} className="rounded-panel border border-border bg-surface p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className={`font-heading text-body-sm font-bold capitalize ${key === today ? "text-accent-ink" : "text-text"}`}>{dayLabel.format(day)}{key === today ? " · vandaag" : ""}</p>
                    {canWrite ? <button type="button" onClick={() => setComposer({ post: null, defaultScheduledAt: localDefault(day) })} aria-label={`Bericht plannen op ${dayLabel.format(day)}`} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border"><Plus className="h-4 w-4" aria-hidden="true" /></button> : null}
                  </div>
                  <DayItems day={day} compact={false} />
                </li>
              );
            })}
            {!monthDays.some((day) => (byDay.get(dayKey(day))?.length ?? 0) > 0) ? <li className="rounded-panel border border-dashed border-border p-4 text-center text-body-sm text-muted">Nog niets ingepland deze maand.</li> : null}
          </ol>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted" aria-label="Legenda">
            {Object.entries(postStatus).map(([key, value]) => <span key={key} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${value.dot}`} aria-hidden="true" />{value.label}</span>)}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-panel border border-border bg-surface p-4 shadow-card" aria-labelledby="unplanned-title">
            <h2 id="unplanned-title" className="font-heading text-body-md font-bold text-text">Nog niet ingepland</h2>
            <ul className="mt-3 grid gap-2">
              {unplanned.map((post) => <li key={post.id}><PostChip post={post} /></li>)}
              {!unplanned.length ? <li className="text-body-sm text-muted">Geen losse concepten.</li> : null}
            </ul>
          </section>
          <CampaignPanel campaigns={campaigns} canWrite={canWrite} onChange={setCampaigns} />
        </aside>
      </div>

      {composer ? (
        <SocialComposer
          key={composer.post?.id ?? `new-${composer.defaultScheduledAt ?? ""}`}
          post={composer.post}
          accounts={accounts}
          campaigns={campaigns}
          defaultScheduledAt={composer.defaultScheduledAt}
          canWrite={canWrite}
          onClose={() => setComposer(null)}
          onSaved={onSaved}
          onCampaignCreated={(campaign) => setCampaigns((current) => [campaign, ...current])}
        />
      ) : null}
    </div>
  );
}
