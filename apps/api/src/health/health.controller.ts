import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("healthz")
  healthz() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("readyz")
  async readyz() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "connected" };
    } catch {
      return { status: "error", db: "disconnected" };
    }
  }
}
