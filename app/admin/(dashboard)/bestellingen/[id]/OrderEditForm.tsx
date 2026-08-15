"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

type SaveState = "idle" | "saving" | "saved" | "error";

async function patchOrder(orderId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Opslaan mislukt (${response.status})`);
  }

  return response.json();
}

export function OrderEditForm({
  orderId,
  initialTrackingCode,
  hasLabel,
  currentStatus,
}: {
  orderId: string;
  initialTrackingCode: string;
  hasLabel: boolean;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();

  const [trackingCode, setTrackingCode] = useState(initialTrackingCode);
  const [trackingState, setTrackingState] = useState<SaveState>("idle");
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [labelState, setLabelState] = useState<SaveState>("idle");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelDetails, setLabelDetails] = useState<string | null>(null);
  const [labelReady, setLabelReady] = useState(hasLabel);
  const canCreateLabel = currentStatus === "PAID" || currentStatus === "FULFILLED";

  async function handleCreateLabel() {
    setLabelState("saving");
    setLabelError(null);
    setLabelDetails(null);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/postnl-label`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setLabelState("error");
        setLabelError(data?.message ?? `Aanmaken mislukt (${response.status})`);
        if (data?.details) {
          setLabelDetails(JSON.stringify(data.details, null, 2));
        }
        return;
      }

      setLabelState("saved");
      setLabelReady(true);
      router.refresh();
    } catch (error) {
      setLabelState("error");
      setLabelError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  async function handleTrackingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackingState("saving");
    setTrackingError(null);

    try {
      await patchOrder(orderId, { postnlTrackingCode: trackingCode });
      setTrackingState("saved");
      router.refresh();
    } catch (error) {
      setTrackingState("error");
      setTrackingError(error instanceof Error ? error.message : "Onbekende fout");
    }
  }

  async function handleStatusChange(status: OrderStatus, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return;

    setPendingStatus(status);
    setStatusState("saving");
    setStatusError(null);

    try {
      await patchOrder(orderId, { status });
      setStatusState("saved");
      router.refresh();
    } catch (error) {
      setStatusState("error");
      setStatusError(error instanceof Error ? error.message : "Onbekende fout");
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-heading-sm text-text">PostNL verzendlabel</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {!labelReady && canCreateLabel ? (
            <button
              type="button"
              onClick={handleCreateLabel}
              disabled={labelState === "saving"}
              className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-4 py-2 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {labelState === "saving" ? "Bezig…" : "Verzendlabel aanmaken"}
            </button>
          ) : null}
          {labelReady ? (
            <a
              href={`/api/admin/orders/${orderId}/postnl-label`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4"
            >
              Bekijk label (PDF)
            </a>
          ) : null}
        </div>
        {!labelReady && !canCreateLabel ? (
          <p className="mt-3 text-body-sm text-muted">
            Een verzendlabel kan pas worden aangemaakt nadat de bestelling is betaald.
          </p>
        ) : null}
        {labelState === "error" && (
          <div className="mt-3 max-w-xl rounded-button border border-red-200 bg-red-50 p-3">
            <p className="text-body-sm text-red-700">{labelError}</p>
            {labelDetails ? (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-600">
                {labelDetails}
              </pre>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading text-heading-sm text-text">PostNL trackingcode</h2>
        <form onSubmit={handleTrackingSubmit} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={trackingCode}
            onChange={(event) => {
              setTrackingCode(event.target.value);
              setTrackingState("idle");
            }}
            placeholder="Bijv. 3SDNL1234567890"
            className="w-full max-w-xs rounded-button border border-border bg-surface px-3 py-2 font-mono text-body-sm text-text focus:border-accent focus:outline-none sm:w-auto"
          />
          <button
            type="submit"
            disabled={trackingState === "saving"}
            className="inline-flex items-center justify-center rounded-button border border-accent bg-accent px-4 py-2 font-heading text-body-sm font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {trackingState === "saving" ? "Opslaan…" : "Opslaan"}
          </button>
          {trackingState === "saved" && (
            <span className="text-body-sm text-green-700">Opgeslagen</span>
          )}
          {trackingState === "error" && (
            <span className="text-body-sm text-red-600">{trackingError}</span>
          )}
        </form>
      </div>

      <div>
        <h2 className="font-heading text-heading-sm text-text">Status handmatig aanpassen</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              handleStatusChange(
                "FULFILLED",
                "Weet je zeker dat je deze bestelling wilt markeren als verzonden?"
              )
            }
            disabled={statusState === "saving" || currentStatus === "FULFILLED"}
            className={cn(
              "inline-flex items-center justify-center rounded-button border border-border px-4 py-2 font-heading text-body-sm font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {statusState === "saving" && pendingStatus === "FULFILLED"
              ? "Bezig…"
              : "Markeer als verzonden"}
          </button>
          <button
            type="button"
            onClick={() =>
              handleStatusChange(
                "CANCELLED",
                "Weet je zeker dat je deze bestelling wilt annuleren?"
              )
            }
            disabled={statusState === "saving" || currentStatus === "CANCELLED"}
            className="inline-flex items-center justify-center rounded-button border border-red-300 bg-red-50 px-4 py-2 font-heading text-body-sm font-semibold text-red-700 transition-colors duration-hover-fast hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusState === "saving" && pendingStatus === "CANCELLED"
              ? "Bezig…"
              : "Annuleer bestelling"}
          </button>
          {statusState === "error" && (
            <span className="text-body-sm text-red-600">{statusError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
