"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";

export function ProductAuditPanel({ productId, initialAdvice }: { productId: string; initialAdvice: string }) {
  const [advice, setAdvice] = useState(initialAdvice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setLoading(true); setError(null);
    const response = await fetch(`/api/admin/products/${productId}/audit`, { method: "POST" });
    const body = await response.json().catch(() => null) as { advice?: string } | null;
    if (response.ok && body?.advice) setAdvice(body.advice); else setError("De controle kon niet worden uitgevoerd.");
    setLoading(false);
  }
  return <div className="space-y-4"><button type="button" onClick={run} disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast sm:w-auto"><Sparkles className="h-5 w-5" />{loading ? "Controleren…" : "Voer AI- en SEO-controle uit"}</button>{error ? <p role="alert" className="text-red-700">{error}</p> : null}<div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><MessageResponse>{advice}</MessageResponse></div></div>;
}
