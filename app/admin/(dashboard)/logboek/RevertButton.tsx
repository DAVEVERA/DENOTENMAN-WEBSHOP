"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RevertButton({ auditLogId }: { auditLogId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRevert() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/audit-log/${auditLogId}/revert`, { method: "POST" });
      if (!response.ok) {
        setError("Terugdraaien is mislukt.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRevert}
        disabled={isPending}
        className="rounded-button border border-border px-3 py-1.5 font-heading text-body-sm font-semibold text-text transition-colors duration-hover-fast hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {isPending ? "Bezig…" : "Terugdraaien"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
