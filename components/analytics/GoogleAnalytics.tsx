"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  canonicalizeBrowserRoute,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  GOOGLE_ANALYTICS_READY_EVENT,
  resolveRoutePageTitle,
  sendGoogleAnalyticsEvent,
} from "@/lib/analytics";

function RoutePageViewTracker({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const lastPageLocation = useRef<string | null>(null);
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    let timeout = 0;
    const startedAt = Date.now();
    const pathChanged = lastPathname.current !== null && lastPathname.current !== pathname;
    const routeStartTitle = document.title.trim();
    let lastDomSignature = "";
    let stableSince = startedAt;

    function trackWhenMetadataIsFinal() {
      if (cancelled) return;

      const pageLocation = window.location.href;
      if (lastPageLocation.current === pageLocation) return;

      const expectedRoute = canonicalizeBrowserRoute(pathname, query);
      const actualRoute = canonicalizeBrowserRoute(
        window.location.pathname,
        window.location.search
      );
      if (actualRoute !== expectedRoute) {
        timeout = window.setTimeout(trackWhenMetadataIsFinal, 50);
        return;
      }

      const currentTitle = document.title.trim();
      const dialogHeading = document
        .querySelector('[role="dialog"][aria-modal="true"] h1')
        ?.textContent?.trim();
      const pageHeading = document.querySelector("main h1")?.textContent?.trim();
      const metadataIsPending =
        (!currentTitle && !dialogHeading && !pageHeading) ||
        (pathChanged &&
          !dialogHeading &&
          !pageHeading &&
          currentTitle === routeStartTitle);
      const domSignature = [actualRoute, currentTitle, dialogHeading, pageHeading].join("\u0000");

      if (domSignature !== lastDomSignature) {
        lastDomSignature = domSignature;
        stableSince = Date.now();
      }

      // Next can stream metadata after the route itself has committed. Wait
      // for the new non-empty title instead of recording "(not set)" or the
      // previous route title. The heading fallback is only a last resort.
      if (
        (metadataIsPending || Date.now() - stableSince < 100) &&
        Date.now() - startedAt < 2000
      ) {
        timeout = window.setTimeout(trackWhenMetadataIsFinal, 50);
        return;
      }

      const pageTitle = resolveRoutePageTitle({
        currentTitle,
        previousDocumentTitle: routeStartTitle || null,
        pathChanged,
        dialogHeading,
        pageHeading,
        pathname,
      });
      if (
        sendGoogleAnalyticsEvent("page_view", {
          page_title: pageTitle,
          page_location: pageLocation,
        })
      ) {
        lastPageLocation.current = pageLocation;
        lastPathname.current = pathname;
      }
    }

    timeout = window.setTimeout(trackWhenMetadataIsFinal, 75);

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [pathname, query, ready]);

  return null;
}

export function GoogleAnalytics() {
  const [ready, setReady] = useState(false);

  function handleReady() {
    window.__denotenmanGoogleAnalyticsReady = true;
    setReady(true);
    window.dispatchEvent(new Event(GOOGLE_ANALYTICS_READY_EVENT));
  }

  return (
    <>
      <Script id="google-analytics-consent" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
          window.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
          window.gtag('js', new Date());
          var denotenmanGaConfig = { anonymize_ip: true, send_page_view: false };
          try {
            var denotenmanReferrerHost = new URL(document.referrer).hostname.toLowerCase();
            if (denotenmanReferrerHost === 'mollie.com' || denotenmanReferrerHost.endsWith('.mollie.com')) {
              denotenmanGaConfig.ignore_referrer = true;
            }
          } catch (_) {}
          window.gtag('config', '${GOOGLE_ANALYTICS_MEASUREMENT_ID}', denotenmanGaConfig);
        `}
      </Script>
      <Script
        id="google-analytics-library"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`}
        strategy="afterInteractive"
        onReady={handleReady}
      />
      <Suspense fallback={null}>
        <RoutePageViewTracker ready={ready} />
      </Suspense>
    </>
  );
}
