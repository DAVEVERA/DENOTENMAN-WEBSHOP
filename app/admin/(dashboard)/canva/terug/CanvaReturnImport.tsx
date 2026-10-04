"use client";

/* eslint-disable @next/next/no-img-element -- the imported image lives in the public media bucket. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import { CANVA_CHANNEL, type CanvaChannelMessage, type CanvaImportedImage } from "@/components/admin-panel/canva/CanvaPicker";

/** Imports the design once, tells the waiting editor tab, and offers the way back. */
export function CanvaReturnImport({ designId, returnTo, pickerId }: { designId: string; returnTo: string; pickerId: string | null }) {
  const [state, setState] = useState<{ status: "busy" } | { status: "done"; images: CanvaImportedImage[]; delivered: boolean } | { status: "error"; message: string }>({ status: "busy" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/canva/designs/${encodeURIComponent(designId)}/import`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ format: "png", pages: [1] }),
        });
        const body = await response.json().catch(() => ({})) as { images?: CanvaImportedImage[]; message?: string };
        if (!response.ok || !body.images?.length) throw new Error(body.message || "Importeren mislukt.");
        let delivered = false;
        if (pickerId && typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel(CANVA_CHANNEL);
          channel.postMessage({ type: "imported", pickerId, images: body.images } satisfies CanvaChannelMessage);
          channel.close();
          delivered = true;
        }
        setState({ status: "done", images: body.images, delivered });
        // A tab the editor opened can close itself; others stay open with the link back.
        if (delivered) window.setTimeout(() => window.close(), 1_500);
      } catch (cause) {
        setState({ status: "error", message: cause instanceof Error ? cause.message : "Importeren mislukt." });
      }
    })();
  }, [designId, pickerId]);

  if (state.status === "busy") {
    return <p className="mt-6 flex items-center gap-2 text-body-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Design ophalen uit Canva en in de mediabibliotheek zetten…</p>;
  }
  if (state.status === "error") {
    return (
      <div className="mt-6 grid gap-3">
        <p role="alert" className="rounded-panel border border-red-200 bg-red-50 p-4 text-body-sm font-semibold text-red-800">{state.message}</p>
        <Link href={returnTo} className="text-body-sm text-accent-hover underline underline-offset-4">Terug naar waar je was</Link>
      </div>
    );
  }
  return (
    <div className="mt-6 grid gap-4">
      <p role="status" className="flex items-center gap-2 rounded-panel border border-green-200 bg-green-50 p-4 text-body-sm font-semibold text-green-800">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        {state.delivered ? "Geïmporteerd en doorgegeven aan je andere tabblad. Dit tabblad mag dicht." : "Geïmporteerd in de mediabibliotheek."}
      </p>
      <img src={state.images[0].url} alt="" className="w-full rounded-card border border-border" />
      <Link href={returnTo} className="inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-4 font-heading text-body-sm font-bold text-contrast">Terug naar waar je was</Link>
    </div>
  );
}
