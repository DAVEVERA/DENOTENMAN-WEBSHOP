import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("healthz")
  healthz(): { status: string; timestamp: string } {
    return this.health.checkLiveness();
  }

  @Get("readyz")
  readyz(): { status: string; checks: Record<string, string> } {
    const result = this.health.checkReadiness();

    if (result.status !== "ok") {
      throw new HttpException(
        { status: result.status, checks: result.checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return result;
  }
}
