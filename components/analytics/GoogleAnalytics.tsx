"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  GOOGLE_ANALYTICS_READY_EVENT,
  sendGoogleAnalyticsEvent,
} from "@/lib/analytics";

function RoutePageViewTracker({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const lastPageLocation = useRef<string | null>(null);
  const lastPathname = useRef<string | null>(null);
  const lastPageTitle = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    let timeout = 0;
    const startedAt = Date.now();
    const routeChanged = lastPathname.current !== null && lastPathname.current !== pathname;

    function trackWhenMetadataIsFinal() {
      if (cancelled) return;

      const pageLocation = window.location.href;
      if (lastPageLocation.current === pageLocation) return;

      const currentTitle = document.title.trim();
      const metadataIsPending =
        !currentTitle ||
        (routeChanged &&
          lastPageTitle.current !== null &&
          currentTitle === lastPageTitle.current);

      // Next can stream metadata after the route itself has committed. Wait
      // for the new non-empty title instead of recording "(not set)" or the
      // previous route title. The heading fallback is only a last resort.
      if (metadataIsPending && Date.now() - startedAt < 2000) {
        timeout = window.setTimeout(trackWhenMetadataIsFinal, 50);
        return;
      }

      const modalHeading = document
        .querySelector('[role="dialog"][aria-modal="true"] h1')
        ?.textContent?.trim();
      const titleDidNotFollowRoute =
        routeChanged &&
        lastPageTitle.current !== null &&
        currentTitle === lastPageTitle.current;
      const pageTitle =
        (titleDidNotFollowRoute && modalHeading
          ? `${modalHeading} | De Notenman`
          : currentTitle) || document.querySelector("h1")?.textContent?.trim() || pathname;
      if (
        sendGoogleAnalyticsEvent("page_view", {
          page_title: pageTitle,
          page_location: pageLocation,
        })
      ) {
        lastPageLocation.current = pageLocation;
        lastPathname.current = pathname;
        lastPageTitle.current = pageTitle;
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
          window.gtag('config', '${GOOGLE_ANALYTICS_MEASUREMENT_ID}', { anonymize_ip: true, send_page_view: false });
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
