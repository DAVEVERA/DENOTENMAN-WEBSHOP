"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import {
  reviewRequestBlockMessage,
  reviewRequestWarningMessage,
  type ReviewRequestBlockReason,
  type ReviewRequestWarning,
} from "@/lib/review-requests";

export function ReviewRequestButton({
  orderId,
  blockedReason,
  warnings,
}: {
  orderId: string;
  blockedReason: ReviewRequestBlockReason | null;
  warnings: ReviewRequestWarning[];
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/review-request`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message ?? `Mislukt (${response.status})`);
        return;
      }
      if (data?.status === "skipped") {
        setError(data?.message ?? "Niet verstuurd.");
        return;
      }
      // No router.refresh() on purpose: the hook cannot render outside the app
      // router, which would leave this button untestable. The local state shows
      // the send; a reload shows the server's own view of it.
      setSent(true);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  // A refund or an open dispute is a reason to look twice, not a reason to
  // refuse, so the first click asks rather than sends. In-page, never a browser
  // dialog: a modal would freeze everything else on the page.
  function handleClick() {
    if (warnings.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void send();
  }

  const label = sent
    ? "Verstuurd"
    : busy
      ? "Bezig…"
      : confirming
        ? "Toch versturen"
        : "Stuur reviewverzoek";

  return (
    <div className="flex flex-col items-start gap-1.5">
      {warnings.map((warning) => (
        <span key={warning} className="text-body-sm text-amber-700">
          {reviewRequestWarningMessage(warning)}
        </span>
      ))}
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || sent || blockedReason !== null}
        className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border bg-background px-2.5 text-xs font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Star className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
      {blockedReason ? (
        <span className="text-body-sm text-muted">{reviewRequestBlockMessage(blockedReason)}</span>
      ) : null}
      {confirming && !busy ? (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-body-sm text-muted underline"
        >
          Annuleren
        </button>
      ) : null}
      {error ? <span className="text-body-sm text-red-600">{error}</span> : null}
    </div>
  );
}
