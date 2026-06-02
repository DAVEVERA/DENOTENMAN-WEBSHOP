export type AnalyticsEvent = {
  name: string;
  sessionId: string;
  properties?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export function createAnalyticsEvent(
  name: string,
  sessionId: string,
  properties?: AnalyticsEvent["properties"],
): AnalyticsEvent {
  if (!name.trim()) throw new Error("Eventnaam ontbreekt.");
  if (!sessionId.trim()) throw new Error("Sessie-id ontbreekt.");
  return {
    name,
    sessionId,
    properties,
    createdAt: new Date().toISOString(),
  };
}
