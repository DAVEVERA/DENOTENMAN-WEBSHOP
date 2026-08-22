"use client";
import { COOKIE_SETTINGS_EVENT } from "@/lib/cookie-consent";

export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
      className="min-h-11 text-left text-background/80 underline-offset-4 hover:text-background hover:underline"
    >
      {label}
    </button>
  );
}
