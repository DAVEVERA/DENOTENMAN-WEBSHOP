"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessAccountCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/business-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: String(form.get("companyName") ?? ""),
          contactName: String(form.get("contactName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? "").trim() || null,
          status: "APPROVED",
        }),
      });
      const data = (await response.json().catch(() => null)) as { businessAccount?: { id: string }; error?: string } | null;
      if (!response.ok || !data?.businessAccount) {
        setError(data?.error === "EMAIL_ALREADY_EXISTS" ? "Dit e-mailadres is al gekoppeld aan een zakelijke klant." : "Account aanmaken is mislukt. Controleer de gegevens en probeer opnieuw.");
        return;
      }
      router.push(`/admin/zakelijk/${data.businessAccount.id}`);
      router.refresh();
    } catch {
      setError("De verbinding viel weg. Controleer of het account is aangemaakt voordat je opnieuw probeert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5 rounded-panel border border-border bg-surface p-5 shadow-card sm:p-7">
      <Field label="Bedrijfsnaam" name="companyName" autoComplete="organization" />
      <Field label="Contactpersoon" name="contactName" autoComplete="name" />
      <Field label="Zakelijk e-mailadres" name="email" type="email" autoComplete="email" />
      <Field label="Telefoonnummer (optioneel)" name="phone" type="tel" autoComplete="tel" required={false} />
      <p className="rounded-card bg-background p-4 text-body-sm text-muted">Het account wordt direct goedgekeurd. De klant krijgt pas toegang nadat jij vanuit het dossier de persoonlijke uitnodiging verstuurt.</p>
      <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-button disabled:opacity-60 sm:w-auto">
        {busy ? "Account aanmaken…" : "Account aanmaken"}
      </button>
      {error ? <p role="alert" className="text-body-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}

function Field({ label, name, type = "text", autoComplete, required = true }: { label: string; name: string; type?: string; autoComplete: string; required?: boolean }) {
  return (
    <label className="block text-body-sm font-semibold text-text">
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required={required} className="mt-1 min-h-12 w-full rounded-button border border-border bg-background px-3 text-body-md text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
    </label>
  );
}
