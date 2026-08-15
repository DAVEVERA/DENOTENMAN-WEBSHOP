"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });

      if (!response.ok) {
        setError("Onjuiste gebruikersnaam of wachtwoord.");
        setSubmitting(false);
        return;
      }

      window.location.href = "/admin";
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-panel border border-border bg-surface p-6 shadow-card"
        noValidate
      >
        <p className="font-heading text-body-sm font-bold uppercase tracking-heading text-accent">
          De Notenman
        </p>
        <h1 className="mt-1 text-heading-lg text-text">Admin</h1>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-body-sm font-semibold text-text">
              Gebruikersnaam
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-body-sm font-semibold text-text">
              Wachtwoord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
        </div>

        {error ? <p role="alert" aria-live="assertive" className="mt-3 text-body-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-md font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Bezig..." : "Inloggen"}
        </button>
      </form>
    </div>
  );
}
