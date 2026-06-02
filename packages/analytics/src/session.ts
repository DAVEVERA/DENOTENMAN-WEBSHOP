export type AnalyticsSession = {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  landingPage?: string;
};

export function createAnalyticsSession(landingPage?: string): AnalyticsSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    startedAt: now,
    lastSeenAt: now,
    landingPage,
  };
}

export function touchAnalyticsSession(session: AnalyticsSession): AnalyticsSession {
  return {
    ...session,
    lastSeenAt: new Date().toISOString(),
  };
}
