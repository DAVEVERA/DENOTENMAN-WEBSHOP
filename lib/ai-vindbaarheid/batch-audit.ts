import { auditRenderedProductPages, type RenderedProductPageAudit, type RenderedProductPageTarget } from "@/lib/rendered-product-page-audit";
import { actionableAuditFindings, type AuditFinding } from "@/lib/ai-vindbaarheid/audit-findings";

export type BatchAuditProduct = {
  id: string;
  sku: string;
  name: string;
  targets: RenderedProductPageTarget[];
};

export type BatchAuditResult = {
  id: string;
  sku: string;
  name: string;
  pages: RenderedProductPageAudit[];
  findings: AuditFinding[];
};

/** Audit a bounded selection in small groups to avoid bursts of requests to the public site. */
export async function runBatchAudit(
  products: BatchAuditProduct[],
  options: { baseUrl: string; fetcher?: typeof fetch; concurrency?: number }
): Promise<BatchAuditResult[]> {
  const concurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency ?? 2)));
  const results: BatchAuditResult[] = [];
  for (let start = 0; start < products.length; start += concurrency) {
    const group = products.slice(start, start + concurrency);
    const completed = await Promise.all(group.map(async (product) => {
      const pages = await auditRenderedProductPages(product.targets, {
        baseUrl: options.baseUrl,
        fetcher: options.fetcher,
        timeoutMs: 8_000,
      });
      return { id: product.id, sku: product.sku, name: product.name, pages, findings: actionableAuditFindings(pages) };
    }));
    results.push(...completed);
  }
  return results;
}
