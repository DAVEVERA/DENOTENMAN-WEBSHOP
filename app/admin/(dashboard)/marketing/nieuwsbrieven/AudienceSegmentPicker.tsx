"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import {
  EMPTY_TARGETING,
  targetingProblem,
  type AudienceSegment,
  type NewsletterTargeting,
} from "@/lib/mailchimp/targeting";

type TagState = "off" | "include" | "exclude";

const pill = "inline-flex min-h-9 items-center justify-center rounded-button border px-3 text-xs font-semibold";

/** How many people a selection reaches, when Mailchimp's own counts can tell. */
function estimate(targeting: NewsletterTargeting, segments: AudienceSegment[]): string {
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  if (targeting.savedSegmentId !== null) {
    const segment = byId.get(targeting.savedSegmentId);
    return segment ? `${segment.memberCount} ontvangers in “${segment.name}”.` : "";
  }
  if (targeting.includeTagIds.length === 1 && targeting.excludeTagIds.length === 0) {
    const tag = byId.get(targeting.includeTagIds[0]);
    return tag ? `${tag.memberCount} ontvangers met de tag “${tag.name}”.` : "";
  }
  return "Mailchimp telt het precieze aantal bij het verzenden.";
}

export function AudienceSegmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: NewsletterTargeting | undefined;
  onChange: (targeting: NewsletterTargeting) => void;
  disabled?: boolean;
}) {
  const targeting = value ?? EMPTY_TARGETING;
  const [segments, setSegments] = useState<AudienceSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"tags" | "saved">(targeting.savedSegmentId !== null ? "saved" : "tags");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/marketing/newsletters/segments", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { segments?: AudienceSegment[]; message?: string };
      if (!response.ok) throw new Error(body.message || "Segmenten laden mislukt.");
      setSegments(body.segments ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Segmenten laden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Loading from Mailchimp is the external system; state is set when it answers.
    let active = true;
    fetch("/api/admin/marketing/newsletters/segments", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { segments?: AudienceSegment[]; message?: string };
        if (!active) return;
        if (!response.ok) setError(body.message || "Segmenten laden mislukt.");
        else setSegments(body.segments ?? []);
      })
      .catch(() => { if (active) setError("Segmenten laden mislukt."); });
    return () => { active = false; };
  }, []);

  const tags = segments?.filter((segment) => segment.type === "static") ?? [];
  const saved = segments?.filter((segment) => segment.type === "saved") ?? [];
  const problem = targetingProblem(targeting);
  // Before anything is chosen the problem is just a hint, not an error.
  const nothingChosen = targeting.savedSegmentId === null && !targeting.includeTagIds.length && !targeting.excludeTagIds.length;

  function tagState(id: number): TagState {
    if (targeting.includeTagIds.includes(id)) return "include";
    if (targeting.excludeTagIds.includes(id)) return "exclude";
    return "off";
  }

  function setTag(id: number, state: TagState) {
    const includeTagIds = targeting.includeTagIds.filter((other) => other !== id);
    const excludeTagIds = targeting.excludeTagIds.filter((other) => other !== id);
    if (state === "include") includeTagIds.push(id);
    if (state === "exclude") excludeTagIds.push(id);
    // Excluding only makes sense with "all", so switch to it for the editor.
    const match = excludeTagIds.length > 0 && includeTagIds.length + excludeTagIds.length > 1 ? "all" : targeting.match;
    onChange({ savedSegmentId: null, includeTagIds, excludeTagIds, match });
  }

  function switchMode(next: "tags" | "saved") {
    setMode(next);
    onChange({ ...EMPTY_TARGETING, savedSegmentId: next === "saved" ? saved[0]?.id ?? null : null });
  }

  return (
    <div className="mt-3 grid gap-3 rounded-card border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Soort selectie">
        {(["tags", "saved"] as const).map((option) => (
          <button key={option} type="button" disabled={disabled} aria-pressed={mode === option} onClick={() => switchMode(option)} className={`${pill} ${mode === option ? "border-accent-ink bg-accent/15" : "border-border bg-surface"}`}>
            {option === "tags" ? "Op tags" : "Opgeslagen segment"}
          </button>
        ))}
        <button type="button" onClick={() => void load()} disabled={loading} className={`${pill} ml-auto gap-1 border-border bg-surface`} aria-label="Segmenten opnieuw laden">
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}Vernieuwen
        </button>
      </div>

      {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
      {segments === null && !error ? <p className="text-body-sm text-muted">Segmenten en tags laden…</p> : null}

      {segments && mode === "saved" ? (
        saved.length ? (
          <label className="grid gap-1 text-body-sm font-semibold text-text">Segment
            <select disabled={disabled} value={targeting.savedSegmentId ?? ""} onChange={(event) => onChange({ ...EMPTY_TARGETING, savedSegmentId: Number(event.target.value) || null })} className="min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base">
              <option value="">Kies een segment</option>
              {saved.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({segment.memberCount})</option>)}
            </select>
          </label>
        ) : <p className="text-body-sm text-muted">Er zijn nog geen opgeslagen segmenten in Mailchimp. Maak ze aan in Mailchimp onder Audience → Segments.</p>
      ) : null}

      {segments && mode === "tags" ? (
        tags.length ? (
          <>
            <ul className="grid max-h-72 gap-1 overflow-y-auto" aria-label="Tags">
              {tags.map((tag) => {
                const state = tagState(tag.id);
                return (
                  <li key={tag.id} className="flex flex-wrap items-center gap-2 rounded-button border border-border bg-surface p-2">
                    <span className="min-w-0 flex-1 text-body-sm"><span className="font-semibold text-text">{tag.name}</span> <span className="text-xs text-muted">{tag.memberCount}</span></span>
                    <span className="flex gap-1" role="group" aria-label={`Tag ${tag.name}`}>
                      {([["off", "Niet"], ["include", "Opnemen"], ["exclude", "Uitsluiten"]] as const).map(([option, label]) => (
                        <button key={option} type="button" disabled={disabled} aria-pressed={state === option} onClick={() => setTag(tag.id, option)} className={`${pill} ${state === option ? option === "exclude" ? "border-red-700 bg-red-50 text-red-800" : "border-accent-ink bg-accent/15" : "border-border bg-background"}`}>{label}</button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
            {targeting.includeTagIds.length > 1 || (targeting.includeTagIds.length > 0 && targeting.excludeTagIds.length > 0) ? (
              <label className="grid gap-1 text-body-sm font-semibold text-text">Wie krijgt de mail?
                <select disabled={disabled} value={targeting.match} onChange={(event) => onChange({ ...targeting, match: event.target.value as "any" | "all" })} className="min-h-11 w-full rounded-button border border-border bg-surface px-3 text-base">
                  <option value="any" disabled={targeting.excludeTagIds.length > 0}>Iedereen met één van de gekozen tags</option>
                  <option value="all">Alleen wie aan alle keuzes voldoet</option>
                </select>
              </label>
            ) : null}
          </>
        ) : <p className="text-body-sm text-muted">Er zijn nog geen tags in deze Mailchimp-audience.</p>
      ) : null}

      <p className={`text-xs ${problem && !nothingChosen ? "font-semibold text-red-700" : "text-muted"}`}>{problem ?? estimate(targeting, segments ?? [])}</p>
    </div>
  );
}
