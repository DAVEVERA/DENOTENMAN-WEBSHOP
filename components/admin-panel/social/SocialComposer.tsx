"use client";

/* eslint-disable @next/next/no-img-element -- previews come from the public media bucket. */

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  captionFor,
  platformProblems,
  SOCIAL_PLATFORM_INFO,
  socialMediaKind,
  TIKTOK_PRIVACY,
  YOUTUBE_PRIVACY,
  type SocialPlatformName,
} from "@/lib/social/platforms";
import type { SocialMediaDto } from "@/lib/social/media";
import type { SocialAccountDto, SocialCampaignDto, SocialPostDto } from "@/lib/social/service";
import { PlatformIcon, platformTone } from "./PlatformIcon";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const labelClass = "grid gap-1 text-body-sm font-semibold text-text";

const youtubePrivacyLabels: Record<(typeof YOUTUBE_PRIVACY)[number], string> = { public: "Openbaar", unlisted: "Verborgen (met link)", private: "Privé" };
const tiktokPrivacyLabels: Record<(typeof TIKTOK_PRIVACY)[number], string> = {
  PUBLIC_TO_EVERYONE: "Iedereen",
  MUTUAL_FOLLOW_FRIENDS: "Vrienden",
  FOLLOWER_OF_CREATOR: "Volgers",
  SELF_ONLY: "Alleen ik",
};

export const targetStatusLabels: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Wacht", className: "bg-border text-text" },
  PUBLISHING: { label: "Bezig", className: "bg-amber-100 text-amber-900" },
  PUBLISHED: { label: "Geplaatst", className: "bg-green-100 text-green-800" },
  FAILED: { label: "Mislukt", className: "bg-red-50 text-red-800" },
};

type UploadState = { key: string; name: string; progress: number; error: string | null };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "Er ging iets mis. Probeer het opnieuw.");
  return body;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type ComposerProps = {
  post: SocialPostDto | null;
  accounts: SocialAccountDto[];
  campaigns: SocialCampaignDto[];
  /** New posts: the day clicked in the calendar, as a local datetime value. */
  defaultScheduledAt?: string;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (post: SocialPostDto | null, message: string) => void;
  onCampaignCreated: (campaign: SocialCampaignDto) => void;
};

export function SocialComposer({ post, accounts, campaigns, defaultScheduledAt, canWrite, onClose, onSaved, onCampaignCreated }: ComposerProps) {
  const locked = post ? ["PUBLISHING", "PUBLISHED"].includes(post.status) : false;
  const readOnly = locked || !canWrite;
  const connected = accounts.filter((account) => account.status === "CONNECTED");
  const [title, setTitle] = useState(post?.title ?? "");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [overrides, setOverrides] = useState<Partial<Record<SocialPlatformName, string>>>(post?.platformCaptions ?? {});
  const [perChannel, setPerChannel] = useState(Object.keys(post?.platformCaptions ?? {}).length > 0);
  const [accountIds, setAccountIds] = useState<string[]>(post ? post.targets.map((target) => target.accountId) : []);
  const [media, setMedia] = useState<SocialMediaDto[]>(post?.media ?? []);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [linkUrl, setLinkUrl] = useState(post?.linkUrl ?? "");
  const [youtubeTitle, setYoutubeTitle] = useState(post?.youtubeTitle ?? "");
  const [youtubePrivacy, setYoutubePrivacy] = useState(post?.youtubePrivacy ?? "public");
  const [tiktokPrivacy, setTiktokPrivacy] = useState(post?.tiktokPrivacy ?? "PUBLIC_TO_EVERYONE");
  const [campaignId, setCampaignId] = useState(post?.campaign?.id ?? "");
  const [newCampaign, setNewCampaign] = useState<{ name: string; color: string } | null>(null);
  const initialMode = post?.status === "SCHEDULED" ? "schedule" : post ? "draft" : defaultScheduledAt ? "schedule" : "draft";
  const [mode, setMode] = useState<"draft" | "schedule" | "now">(initialMode);
  const [scheduledAt, setScheduledAt] = useState(post?.scheduledAt ? toLocalInput(post.scheduledAt) : defaultScheduledAt ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assist, setAssist] = useState<{ instruction: string; result: { captions: Partial<Record<SocialPlatformName, string>>; youtubeTitle: string | null; notes: string } | null } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = connected.filter((account) => accountIds.includes(account.id));
  const platforms = [...new Set(selected.map((account) => account.platform))];
  const content = { caption, platformCaptions: perChannel ? overrides : {}, media: media.map((item) => ({ contentType: item.contentType })), linkUrl, youtubeTitle };
  const problems = platforms.map((platform) => ({ platform, problems: platformProblems(platform, content) })).filter((row) => row.problems.length);
  const captionLimit = platforms.length ? Math.min(...platforms.map((platform) => SOCIAL_PLATFORM_INFO[platform].captionLimit)) : 63_206;

  function toggleAccount(id: string) {
    setAccountIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function uploadFile(file: File) {
    const key = `${file.name}-${file.size}-${Date.now()}`;
    setUploads((current) => [...current, { key, name: file.name, progress: 0, error: null }]);
    const update = (patch: Partial<UploadState>) => setUploads((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
    try {
      if (!socialMediaKind(file.type)) throw new Error("Gebruik een JPG-, PNG- of WebP-foto, of een MP4-, MOV- of WebM-video.");
      const start = await api<{ id: string; chunkBytes: number }>("/api/admin/social/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      for (let offset = 0; offset < file.size; offset += start.chunkBytes) {
        const chunk = file.slice(offset, Math.min(offset + start.chunkBytes, file.size));
        await api(`/api/admin/social/media/${encodeURIComponent(start.id)}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream", "x-upload-offset": String(offset) },
          body: chunk,
        });
        update({ progress: Math.round(((offset + chunk.size) / file.size) * 100) });
      }
      const done = await api<{ media: SocialMediaDto }>(`/api/admin/social/media/${encodeURIComponent(start.id)}`, { method: "POST" });
      setMedia((current) => [...current, done.media]);
      setUploads((current) => current.filter((item) => item.key !== key));
    } catch (cause) {
      update({ error: cause instanceof Error ? cause.message : "Uploaden mislukt." });
    }
  }

  function moveMedia(index: number, delta: number) {
    setMedia((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item);
      return next;
    });
  }

  async function createCampaign() {
    if (!newCampaign?.name.trim()) return;
    setBusy("campaign");
    try {
      const body = await api<{ campaign: SocialCampaignDto }>("/api/admin/social/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCampaign.name, description: null, color: newCampaign.color, startsAt: null, endsAt: null }),
      });
      onCampaignCreated(body.campaign);
      setCampaignId(body.campaign.id);
      setNewCampaign(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Campagne aanmaken mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function runAssist() {
    if (!assist) return;
    setBusy("assist");
    setError(null);
    try {
      const result = await api<{ captions: Partial<Record<SocialPlatformName, string>>; youtubeTitle: string | null; notes: string }>("/api/admin/social/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          caption,
          platforms: platforms.length ? platforms : ["FACEBOOK", "INSTAGRAM"],
          instruction: assist.instruction || undefined,
          hasVideo: media.some((item) => item.kind === "video"),
          linkUrl: linkUrl || null,
        }),
      });
      setAssist({ ...assist, result });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI-suggesties ophalen mislukt.");
    } finally {
      setBusy(null);
    }
  }

  function applySuggestion(platform: SocialPlatformName, text: string) {
    if (platforms.length <= 1 && !perChannel) {
      setCaption(text);
    } else {
      setPerChannel(true);
      setOverrides((current) => ({ ...current, [platform]: text }));
    }
  }

  async function save() {
    setError(null);
    if (uploads.some((item) => !item.error)) {
      setError("Wacht tot alle bestanden zijn geüpload.");
      return;
    }
    if (mode !== "draft" && !selected.length) {
      setError("Kies minimaal één kanaal.");
      return;
    }
    if (mode !== "draft" && problems.length) {
      setError(`${SOCIAL_PLATFORM_INFO[problems[0].platform].label}: ${problems[0].problems[0]}`);
      return;
    }
    if (mode === "schedule" && !scheduledAt) {
      setError("Kies wanneer het bericht geplaatst moet worden.");
      return;
    }
    setBusy(mode === "now" ? "publish" : "save");
    try {
      const payload = {
        title: title.trim() || caption.trim().split(/\r?\n/u)[0]?.slice(0, 80) || "Bericht",
        caption,
        platformCaptions: perChannel ? Object.fromEntries(platforms.map((platform) => [platform, overrides[platform] ?? ""])) : null,
        mediaIds: media.map((item) => item.id),
        linkUrl: linkUrl.trim() || null,
        youtubeTitle: youtubeTitle.trim() || null,
        youtubePrivacy,
        tiktokPrivacy,
        accountIds: selected.map((account) => account.id),
        scheduledAt: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
        campaignId: campaignId || null,
      };
      const saved = await api<{ post: SocialPostDto }>(post ? `/api/admin/social/posts/${encodeURIComponent(post.id)}` : "/api/admin/social/posts", {
        method: post ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (mode === "now") {
        const published = await api<{ post: SocialPostDto }>(`/api/admin/social/posts/${encodeURIComponent(saved.post.id)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "publishNow" }),
        });
        const failed = published.post.targets.filter((target) => target.status === "FAILED");
        onSaved(published.post, failed.length ? `Geplaatst met fouten: ${failed.map((target) => target.accountName).join(", ")}.` : "Het bericht is geplaatst.");
      } else {
        onSaved(saved.post, mode === "schedule" ? "Het bericht is ingepland." : "Concept opgeslagen.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function action(name: "retry" | "unschedule" | "duplicate") {
    if (!post) return;
    setBusy(name);
    setError(null);
    try {
      const body = await api<{ post: SocialPostDto }>(`/api/admin/social/posts/${encodeURIComponent(post.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: name }),
      });
      onSaved(body.post, { retry: "Opnieuw geprobeerd.", unschedule: "Uit de planning gehaald; het staat nu als concept.", duplicate: "Kopie gemaakt." }[name]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Er ging iets mis.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!post || !window.confirm("Dit bericht verwijderen uit de planning? Al geplaatste berichten blijven op de kanalen staan.")) return;
    setBusy("delete");
    try {
      await api(`/api/admin/social/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      onSaved(null, "Bericht verwijderd.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verwijderen mislukt.");
      setBusy(null);
    }
  }

  const hasYouTube = platforms.includes("YOUTUBE");
  const hasTikTok = platforms.includes("TIKTOK");

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="composer-title" className="fixed inset-0 z-50 flex justify-end bg-contrast/50">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-background shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <h2 id="composer-title" className="min-w-0 truncate text-heading-md text-text">{post ? (readOnly ? "Bericht bekijken" : "Bericht bewerken") : "Nieuw bericht"}</h2>
          <button type="button" onClick={onClose} aria-label="Sluiten" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-border bg-surface text-text"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-4 py-5 sm:px-6">
          {post && post.targets.length && post.status !== "DRAFT" ? (
            <section className="grid gap-2 rounded-panel border border-border bg-surface p-4" aria-label="Status per kanaal">
              <h3 className="font-heading text-body-md font-bold text-text">Status per kanaal</h3>
              <ul className="grid gap-2">
                {post.targets.map((target) => {
                  const badge = targetStatusLabels[target.status] ?? targetStatusLabels.PENDING;
                  return (
                    <li key={target.id} className="flex flex-wrap items-center gap-2 text-body-sm">
                      <PlatformIcon platform={target.platform} />
                      <span className="font-semibold text-text">{target.accountName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.className}`}>{badge.label}</span>
                      {target.permalink ? <a href={target.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-ink underline underline-offset-4">Bekijken<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : null}
                      {target.error ? <span className="w-full text-red-700">{target.error}</span> : null}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                {canWrite && (post.status === "FAILED" || post.status === "PARTIAL") ? <button type="button" disabled={Boolean(busy)} onClick={() => void action("retry")} className={`${buttonClass} bg-accent-ink text-surface`}><RotateCcw className="h-4 w-4" aria-hidden="true" />Mislukte kanalen opnieuw proberen</button> : null}
                {canWrite && post.status === "SCHEDULED" ? <button type="button" disabled={Boolean(busy)} onClick={() => void action("unschedule")} className={`${buttonClass} border border-border bg-surface text-text`}><Undo2 className="h-4 w-4" aria-hidden="true" />Uit planning halen</button> : null}
              </div>
            </section>
          ) : null}

          <fieldset disabled={readOnly} className="grid gap-5">
            <section className="grid gap-2" aria-labelledby="channels-title">
              <h3 id="channels-title" className="font-heading text-body-md font-bold text-text">Kanalen</h3>
              {connected.length ? (
                <div className="flex flex-wrap gap-2">
                  {connected.map((account) => {
                    const active = accountIds.includes(account.id);
                    return (
                      <button key={account.id} type="button" aria-pressed={active} onClick={() => toggleAccount(account.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-button border px-3 text-body-sm font-semibold ${active ? `${platformTone(account.platform)} border-transparent` : "border-border bg-surface text-muted"}`}>
                        <PlatformIcon platform={account.platform} />{account.displayName}
                        {active ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm text-amber-900">Er is nog geen kanaal gekoppeld. <Link href="/admin/marketing/social/kanalen" className="font-semibold underline underline-offset-4">Koppel Facebook, Instagram, TikTok of YouTube</Link>. Je kunt wel alvast een concept maken.</p>
              )}
            </section>

            <label className={labelClass}>Werktitel (alleen intern)<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Bijvoorbeeld: Najaarsmix in de kraam" className={inputClass} /></label>

            <section className="grid gap-2" aria-labelledby="text-title">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 id="text-title" className="font-heading text-body-md font-bold text-text">Tekst</h3>
                <span className={`text-xs ${caption.length > captionLimit ? "font-bold text-red-700" : "text-muted"}`}>{caption.length.toLocaleString("nl-NL")} / {captionLimit.toLocaleString("nl-NL")}</span>
              </div>
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={6} className={`${inputClass} py-3 leading-6`} aria-label="Tekst van het bericht" placeholder="Wat wil je vertellen?" />
              <div className="flex flex-wrap gap-2">
                {canWrite && !readOnly ? <button type="button" onClick={() => setAssist(assist ? null : { instruction: "", result: null })} className={`${buttonClass} border border-accent-ink bg-surface text-accent-ink`}><Sparkles className="h-4 w-4" aria-hidden="true" />Verbeter met AI</button> : null}
                {platforms.length > 1 ? (
                  <label className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-text"><input type="checkbox" checked={perChannel} onChange={(event) => setPerChannel(event.target.checked)} />Tekst per kanaal aanpassen</label>
                ) : null}
              </div>

              {assist ? (
                <div className="grid gap-3 rounded-panel border border-accent/60 bg-accent/10 p-4">
                  <label className={labelClass}>Extra wens (optioneel)<input value={assist.instruction} onChange={(event) => setAssist({ ...assist, instruction: event.target.value })} maxLength={500} placeholder="Bijvoorbeeld: speels, noem de marktdag in Haaren" className={inputClass} /></label>
                  <button type="button" disabled={busy === "assist"} onClick={() => void runAssist()} className={`${buttonClass} justify-self-start bg-accent text-contrast`}>{busy === "assist" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}Suggesties maken</button>
                  {assist.result ? (
                    <div className="grid gap-3">
                      {Object.entries(assist.result.captions).map(([platform, text]) => (
                        <div key={platform} className="grid gap-2 rounded-card border border-border bg-surface p-3">
                          <p className="flex items-center gap-2 text-body-sm font-bold text-text"><PlatformIcon platform={platform as SocialPlatformName} />{SOCIAL_PLATFORM_INFO[platform as SocialPlatformName].label}</p>
                          <p className="whitespace-pre-wrap text-body-sm leading-6 text-text">{text}</p>
                          <button type="button" onClick={() => applySuggestion(platform as SocialPlatformName, text ?? "")} className={`${buttonClass} justify-self-start border border-border bg-surface text-text`}>Gebruik deze tekst</button>
                        </div>
                      ))}
                      {assist.result.youtubeTitle ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3 text-body-sm"><strong>YouTube-titel:</strong> {assist.result.youtubeTitle}<button type="button" onClick={() => setYoutubeTitle(assist.result!.youtubeTitle!)} className={`${buttonClass} border border-border bg-surface text-text`}>Gebruik</button></div>
                      ) : null}
                      {assist.result.notes ? <p className="text-xs text-muted">{assist.result.notes}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {perChannel && platforms.length > 1 ? (
                <div className="grid gap-3">
                  {platforms.map((platform) => (
                    <label key={platform} className={labelClass}>
                      <span className="flex items-center gap-2"><PlatformIcon platform={platform} />{SOCIAL_PLATFORM_INFO[platform].label}</span>
                      <textarea value={overrides[platform] ?? ""} onChange={(event) => setOverrides((current) => ({ ...current, [platform]: event.target.value }))} rows={4} placeholder={caption || "Gebruikt de algemene tekst"} className={`${inputClass} py-3 leading-6`} />
                    </label>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="grid gap-2" aria-labelledby="media-title">
              <h3 id="media-title" className="font-heading text-body-md font-bold text-text">Foto&apos;s en video</h3>
              {media.length ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {media.map((item, index) => (
                    <li key={item.id} className="grid gap-1 rounded-card border border-border bg-surface p-2">
                      <div className="aspect-square overflow-hidden rounded-card bg-background">
                        {item.kind === "video" ? <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : <img src={item.url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <p className="truncate text-xs text-muted">{item.filename}</p>
                      <div className="flex justify-between gap-1">
                        <button type="button" disabled={index === 0} onClick={() => moveMedia(index, -1)} aria-label="Naar voren" className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface disabled:opacity-40"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => setMedia((current) => current.filter((other) => other.id !== item.id))} aria-label={`${item.filename} verwijderen`} className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" disabled={index === media.length - 1} onClick={() => moveMedia(index, 1)} aria-label="Naar achteren" className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-border bg-surface disabled:opacity-40"><ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {uploads.map((upload) => (
                <div key={upload.key} className="grid gap-1 text-body-sm">
                  <span className="flex justify-between gap-2"><span className="truncate">{upload.name}</span><span className={upload.error ? "text-red-700" : "text-muted"}>{upload.error ? "Mislukt" : `${upload.progress}%`}</span></span>
                  {upload.error ? <span className="text-red-700">{upload.error} <button type="button" onClick={() => setUploads((current) => current.filter((item) => item.key !== upload.key))} className="underline">Sluiten</button></span> : <progress value={upload.progress} max={100} className="h-2 w-full" aria-label={`Upload ${upload.name}`} />}
                </div>
              ))}
              <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(event) => { for (const file of Array.from(event.target.files ?? [])) void uploadFile(file); event.target.value = ""; }} />
              <button type="button" onClick={() => fileInput.current?.click()} className={`${buttonClass} justify-self-start border border-dashed border-border bg-surface text-text`}><ImagePlus className="h-4 w-4" aria-hidden="true" />Foto of video toevoegen</button>
              <p className="text-xs text-muted">Foto&apos;s tot 20 MB, video&apos;s tot 1 GB. Instagram-foto&apos;s worden automatisch als JPG geplaatst.</p>
            </section>

            {platforms.includes("FACEBOOK") ? (
              <label className={labelClass}>Link (Facebook, optioneel)<input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://denotenman.com/…" className={inputClass} /></label>
            ) : null}

            {hasYouTube || hasTikTok ? (
              <section className="grid gap-3 sm:grid-cols-2">
                {hasYouTube ? (
                  <>
                    <label className={`${labelClass} sm:col-span-2`}>YouTube-titel<input value={youtubeTitle} onChange={(event) => setYoutubeTitle(event.target.value)} maxLength={100} placeholder="Laat leeg om de eerste regel van de tekst te gebruiken" className={inputClass} /></label>
                    <label className={labelClass}>Zichtbaarheid YouTube<select value={youtubePrivacy} onChange={(event) => setYoutubePrivacy(event.target.value)} className={inputClass}>{YOUTUBE_PRIVACY.map((value) => <option key={value} value={value}>{youtubePrivacyLabels[value]}</option>)}</select></label>
                  </>
                ) : null}
                {hasTikTok ? (
                  <label className={labelClass}>Zichtbaarheid TikTok<select value={tiktokPrivacy} onChange={(event) => setTiktokPrivacy(event.target.value)} className={inputClass}>{TIKTOK_PRIVACY.map((value) => <option key={value} value={value}>{tiktokPrivacyLabels[value]}</option>)}</select></label>
                ) : null}
                <p className="text-xs text-muted sm:col-span-2">Zolang TikTok en Google de koppeling nog niet hebben goedgekeurd, plaatsen zij video&apos;s alleen privé. Je zet ze daarna zelf op openbaar in de app.</p>
              </section>
            ) : null}

            <section className="grid gap-2" aria-labelledby="campaign-title">
              <h3 id="campaign-title" className="font-heading text-body-md font-bold text-text">Campagne</h3>
              <div className="flex flex-wrap gap-2">
                <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} aria-label="Campagne" className={`${inputClass} sm:w-auto sm:min-w-64`}>
                  <option value="">Geen campagne</option>
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
                {!newCampaign && canWrite ? <button type="button" onClick={() => setNewCampaign({ name: "", color: "#B7791F" })} className={`${buttonClass} border border-border bg-surface text-text`}>Nieuwe campagne</button> : null}
              </div>
              {newCampaign ? (
                <div className="flex flex-wrap items-end gap-2 rounded-card border border-border bg-surface p-3">
                  <label className={`${labelClass} min-w-48 flex-1`}>Naam<input value={newCampaign.name} onChange={(event) => setNewCampaign({ ...newCampaign, name: event.target.value })} maxLength={120} className={inputClass} /></label>
                  <label className={labelClass}>Kleur<input type="color" value={newCampaign.color} onChange={(event) => setNewCampaign({ ...newCampaign, color: event.target.value })} className="h-11 w-16 rounded-button border border-border bg-surface" /></label>
                  <button type="button" disabled={busy === "campaign" || !newCampaign.name.trim()} onClick={() => void createCampaign()} className={`${buttonClass} bg-accent-ink text-surface`}>Aanmaken</button>
                  <button type="button" onClick={() => setNewCampaign(null)} className={`${buttonClass} border border-border bg-surface text-text`}>Annuleren</button>
                </div>
              ) : null}
            </section>

            <section className="grid gap-2" aria-labelledby="planning-title">
              <h3 id="planning-title" className="font-heading text-body-md font-bold text-text">Planning</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {([["draft", "Concept"], ["schedule", "Inplannen"], ["now", "Nu plaatsen"]] as const).map(([value, label]) => (
                  <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-button border px-3 text-body-sm font-semibold ${mode === value ? "border-accent-ink bg-accent/15 text-text" : "border-border bg-surface text-muted"}`}>
                    <input type="radio" name="planning" value={value} checked={mode === value} onChange={() => setMode(value)} />{label}
                  </label>
                ))}
              </div>
              {mode === "schedule" ? <label className={labelClass}>Datum en tijd<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className={inputClass} /></label> : null}
            </section>

            {selected.length && problems.length ? (
              <section role="status" className="grid gap-1 rounded-card border border-amber-300 bg-amber-50 p-3 text-body-sm text-amber-900">
                {problems.map((row) => row.problems.map((problem) => (
                  <p key={`${row.platform}-${problem}`} className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><strong>{SOCIAL_PLATFORM_INFO[row.platform].label}:</strong> {problem}</span></p>
                )))}
              </section>
            ) : null}

            {selected.length ? (
              <section className="grid gap-2" aria-labelledby="preview-title">
                <h3 id="preview-title" className="font-heading text-body-md font-bold text-text">Voorbeeld</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {platforms.map((platform) => (
                    <article key={platform} className="grid gap-2 rounded-panel border border-border bg-surface p-3">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-muted"><PlatformIcon platform={platform} />{SOCIAL_PLATFORM_INFO[platform].label}</p>
                      {media[0] ? (media[0].kind === "video" ? <video src={media[0].url} className="aspect-square w-full rounded-card bg-background object-cover" muted playsInline preload="metadata" /> : <img src={media[0].url} alt="" className="aspect-square w-full rounded-card bg-background object-cover" />) : null}
                      {platform === "YOUTUBE" ? <p className="text-body-sm font-bold text-text">{youtubeTitle || caption.split(/\r?\n/u)[0]}</p> : null}
                      <p className="line-clamp-6 whitespace-pre-wrap text-body-sm leading-6 text-text">{captionFor({ caption, platformCaptions: perChannel ? overrides : {} }, platform) || <span className="italic text-muted">Nog geen tekst</span>}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </fieldset>

          {error ? <p role="alert" className="rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-800">{error}</p> : null}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-4 py-3 sm:px-6">
          {post && canWrite ? (
            <>
              <button type="button" disabled={Boolean(busy)} onClick={() => void action("duplicate")} className={`${buttonClass} border border-border bg-surface text-text`}><Copy className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Dupliceren</span></button>
              {post.status !== "PUBLISHING" ? <button type="button" disabled={Boolean(busy)} onClick={() => void remove()} className={`${buttonClass} border border-border bg-surface text-red-700`}><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Verwijderen</span></button> : null}
            </>
          ) : null}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={`${buttonClass} border border-border bg-surface text-text`}>Sluiten</button>
          {!readOnly ? (
            <button type="button" disabled={Boolean(busy)} onClick={() => void save()} className={`${buttonClass} ${mode === "now" ? "bg-accent text-contrast" : "bg-accent-ink text-surface"}`}>
              {busy === "save" || busy === "publish" ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : mode === "now" ? <Send className="h-4 w-4" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}
              {busy === "publish" ? "Bezig met plaatsen…" : mode === "now" ? "Nu plaatsen" : mode === "schedule" ? "Inplannen" : "Concept opslaan"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
