"use client";

import { useEffect } from "react";

type UserAgentData = { getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platformVersion?: string }> };

/** Reports a visit to the invoice pages once, with the screen size and Chrome's device hints. */
export function InvoiceViewBeacon({ kind, invoiceId }: { kind: "OVERVIEW" | "INVOICE"; invoiceId?: string }) {
  useEffect(() => {
    let cancelled = false;
    async function report() {
      const agentData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
      const hints = await agentData?.getHighEntropyValues?.(["model", "platformVersion"]).catch(() => undefined);
      if (cancelled) return;
      await fetch("/api/admin/developer-invoices/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          kind,
          invoiceId: invoiceId ?? null,
          screen: { width: Math.round(window.screen.width), height: Math.round(window.screen.height), pixelRatio: window.devicePixelRatio || 1 },
          hints: hints ? { model: hints.model || null, platformVersion: hints.platformVersion || null } : null,
        }),
      }).catch(() => undefined);
    }
    void report();
    return () => { cancelled = true; };
  }, [kind, invoiceId]);
  return null;
}
