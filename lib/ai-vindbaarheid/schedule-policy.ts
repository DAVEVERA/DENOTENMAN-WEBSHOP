/** Pure policy for durable storefront crawl cycles; no database or network calls. */
export const GEO_AUDIT_BATCH_SIZE = 6;
export const GEO_AUDIT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function geoAuditNextDueAt(finishedAt: Date): Date {
  return new Date(finishedAt.getTime() + GEO_AUDIT_INTERVAL_MS);
}

export function geoAuditShouldStart(nextDueAt: Date, now: Date, activeRunId: string | null): boolean {
  return !activeRunId && nextDueAt.getTime() <= now.getTime();
}

export function geoAuditBatchFinished(returnedProductCount: number): boolean {
  // Exact full batches require one additional empty read to distinguish end-of-list.
  return returnedProductCount < GEO_AUDIT_BATCH_SIZE;
}
