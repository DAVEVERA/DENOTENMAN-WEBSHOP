"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

// Routes on which Session Replay must be disabled (ADR 0011 — privacy).
const REPLAY_BLOCKED_PREFIXES = ["/checkout", "/account"];

function isBlockedRoute(pathname: string): boolean {
  return REPLAY_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Stops Sentry Session Replay on sensitive routes (/checkout, /account).
 * Must be rendered inside the app layout so it runs on every client navigation.
 * Renders nothing — side-effects only.
 */
export function ReplayRouteGuard(): null {
  const pathname = usePathname();

  useEffect(() => {
    const replay = Sentry.getReplay();
    if (!replay) {
      return;
    }
    if (isBlockedRoute(pathname)) {
      // stop() returns Promise<void> — fire-and-forget; errors are non-fatal.
      replay.stop().catch(() => {
        // Replay control errors are non-fatal — swallow silently.
      });
    } else {
      // Re-start replay when navigating back to a non-sensitive route.
      // start() returns void synchronously — no await needed.
      replay.start();
    }
  }, [pathname]);

  return null;
}
