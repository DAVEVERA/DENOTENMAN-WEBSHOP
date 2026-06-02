export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function createDefaultConsent(): ConsentState {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  };
}

export function updateConsent(current: ConsentState, patch: Partial<Omit<ConsentState, "necessary">>) {
  return {
    ...current,
    ...patch,
    necessary: true as const,
    updatedAt: new Date().toISOString(),
  };
}
