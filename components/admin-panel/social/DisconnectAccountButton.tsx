"use client";

import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { useState } from "react";

export function DisconnectAccountButton({ accountId, name }: { accountId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!window.confirm(`${name} ontkoppelen? Ingeplande berichten voor dit kanaal worden dan niet geplaatst.`)) return;
    setBusy(true);
    await fetch(`/api/admin/social/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" }).catch(() => undefined);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" disabled={busy} onClick={() => void disconnect()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-bold text-red-700 disabled:opacity-50">
      <Unplug className="h-4 w-4" aria-hidden="true" />Ontkoppelen
    </button>
  );
}
