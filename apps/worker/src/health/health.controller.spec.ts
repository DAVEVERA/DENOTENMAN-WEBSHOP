import "reflect-metadata";
import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthController } from "./health.controller";
import { HealthService, type ReadinessResult } from "./health.service";

describe("HealthController", () => {
  let service: HealthService;
  let controller: HealthController;

  beforeEach(() => {
    service = new HealthService();
    controller = new HealthController(service);
  });

  describe("GET /healthz", () => {
    it("returns status ok with a timestamp", () => {
      const result = controller.healthz();
      expect(result.status).toBe("ok");
      expect(typeof result.timestamp).toBe("string");
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe("GET /readyz", () => {
    it("returns 200 body with status ok when all checks pass", () => {
      const result = controller.readyz();
      expect(result.status).toBe("ok");
    });

    it("throws HttpException 503 when a dependency is unhealthy", () => {
      const failing: ReadinessResult = {
        status: "error",
        checks: { redis: "unreachable" },
      };
      vi.spyOn(service, "checkReadiness").mockReturnValueOnce(failing);

      expect(() => controller.readyz()).toThrow(HttpException);

      vi.spyOn(service, "checkReadiness").mockReturnValueOnce(failing);

      try {
        controller.readyz();
        expect.fail("expected readyz to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        const body = httpErr.getResponse() as {
          status: string;
          checks: Record<string, string>;
        };
        expect(body.status).toBe("error");
        expect(body.checks).toEqual({ redis: "unreachable" });
      }
    });
  });
});
