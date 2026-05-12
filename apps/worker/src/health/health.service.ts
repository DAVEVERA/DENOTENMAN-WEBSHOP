import { Injectable } from "@nestjs/common";

export interface ReadinessResult {
  status: "ok" | "error";
  checks: Record<string, string>;
}

@Injectable()
export class HealthService {
  checkLiveness(): { status: string; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  checkReadiness(): ReadinessResult {
    // No external deps wired yet — always ready.
    // When deps (Redis, DB) are added, probe them here and return
    // status "error" with a descriptive checks map on failure.
    return { status: "ok", checks: {} };
  }
}
