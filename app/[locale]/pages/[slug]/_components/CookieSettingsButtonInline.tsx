"use client";
import { COOKIE_SETTINGS_EVENT } from "@/lib/cookie-consent";

export function CookieSettingsButtonInline() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))} className="min-h-11 rounded-button border-2 border-contrast bg-contrast px-5 py-2 font-heading font-bold text-surface hover:bg-[#4a4a4a]">
      Cookie-instellingen openen
    </button>
  );
}
