import type { RenderedProductPageAudit } from "@/lib/rendered-product-page-audit";

const highPriority = new Set(["http-status", "robots", "canonical", "visible-description", "product-jsonld"]);

export type AuditFinding = {
  locale: string;
  url: string;
  code: string;
  label: string;
  recommendation: string;
  priority: "hoog" | "normaal";
};

export function actionableAuditFindings(pages: RenderedProductPageAudit[]): AuditFinding[] {
  return pages.flatMap((page) =>
    page.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        locale: page.locale,
        url: page.url,
        code: check.code,
        label: check.label,
        recommendation: check.recommendation,
        priority: highPriority.has(check.code) ? "hoog" as const : "normaal" as const,
      }))
  ).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "hoog" ? -1 : 1));
}
