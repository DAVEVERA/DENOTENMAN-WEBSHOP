"use client";

import { useState } from "react";
import { BusinessGoogleLoginButton } from "./BusinessGoogleLoginButton";
import { BusinessPasswordLoginForm } from "./BusinessPasswordLoginForm";
import { BusinessLoginLinkRequestForm } from "./BusinessLoginLinkRequestForm";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_unavailable: "Inloggen met Google is momenteel niet beschikbaar.",
  google_failed: "Inloggen met Google is niet gelukt. Probeer het opnieuw.",
  google_email_unverified: "Je Google-account heeft geen bevestigd e-mailadres. Log in met je e-mailadres en wachtwoord.",
  google_no_account: "Dit Google-account is niet gekoppeld aan een zakelijke omgeving. Vraag Fedor om een uitnodiging, of log in met je e-mailadres.",
};

export function BusinessLoginOptions({ locale, googleConfigured, oauthError }: { locale: string; googleConfigured: boolean; oauthError?: string }) {
  const [showLinkRequest, setShowLinkRequest] = useState(false);

  return (
    <div>
      {oauthError ? (
        <p role="alert" className="mt-6 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm font-semibold text-red-700">
          {OAUTH_ERROR_MESSAGES[oauthError] ?? "Inloggen is niet gelukt. Probeer het opnieuw."}
        </p>
      ) : null}

      {googleConfigured ? (
        <>
          <div className="mt-6"><BusinessGoogleLoginButton /></div>
          <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted"><span className="h-px flex-1 bg-border" />of<span className="h-px flex-1 bg-border" /></div>
        </>
      ) : null}

      <BusinessPasswordLoginForm locale={locale} />

      {showLinkRequest ? (
        <div className="mt-4">
          <BusinessLoginLinkRequestForm />
        </div>
      ) : (
        <button type="button" onClick={() => setShowLinkRequest(true)} className="mt-4 text-body-sm font-semibold text-accent-hover underline underline-offset-4">
          Nog geen wachtwoord? Vraag een inloglink aan
        </button>
      )}
    </div>
  );
}
