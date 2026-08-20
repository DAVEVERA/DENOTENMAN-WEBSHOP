import { parseCloudCostDays, type CloudCostPeriod } from "@/lib/cloud-costs";

type CloudCostsRouteDependencies = {
  authenticate(request: Request): Promise<boolean>;
  loadCosts(days: CloudCostPeriod): Promise<unknown>;
};

const SAFE_PROVIDER_ERRORS = new Set([
  "BILLING_EXPORT_NOT_CONFIGURED",
  "BILLING_EXPORT_FORBIDDEN",
  "BILLING_EXPORT_UNAVAILABLE",
  "INVALID_CONFIGURATION",
]);

export function createCloudCostsGetHandler(dependencies: CloudCostsRouteDependencies) {
  return async function GET(request: Request): Promise<Response> {
    if (!(await dependencies.authenticate(request))) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const days = parseCloudCostDays(new URL(request.url).searchParams.get("days"));
    try {
      const report = await dependencies.loadCosts(days);
      return Response.json(report, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error && typeof error.code === "string"
          ? error.code
          : "BILLING_EXPORT_UNAVAILABLE";
      const safeCode = SAFE_PROVIDER_ERRORS.has(code) ? code : "BILLING_EXPORT_UNAVAILABLE";
      return Response.json({ error: safeCode }, { status: 503 });
    }
  };
}
