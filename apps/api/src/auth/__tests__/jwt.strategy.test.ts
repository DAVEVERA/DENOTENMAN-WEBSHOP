import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { JwtStrategy } from "../jwt.strategy";

describe("JwtStrategy.validate", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
  });

  it("returns an AuthenticatedUser from a valid payload", () => {
    const strategy = new JwtStrategy();
    const result = strategy.validate({
      sub: "uuid-1",
      email: "user@example.com",
      role: "customer",
      iss: "denotenman-api",
      aud: "denotenman-client",
    });
    expect(result).toEqual({ sub: "uuid-1", email: "user@example.com", role: "customer" });
  });

  it("throws UnauthorizedException when sub is missing", () => {
    const strategy = new JwtStrategy();
    expect(() =>
      strategy.validate({ sub: "", email: "x@y.com", role: "customer", iss: "", aud: "" }),
    ).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when email is missing", () => {
    const strategy = new JwtStrategy();
    expect(() =>
      strategy.validate({ sub: "id", email: "", role: "customer", iss: "", aud: "" }),
    ).toThrow(UnauthorizedException);
  });
});

describe("JWT algorithm enforcement", () => {
  const ACCESS = "access-secret-32-bytes-random!!!!";
  const REFRESH = "refresh-secret-32-bytes-random!!!";

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = ACCESS;
    process.env.JWT_REFRESH_SECRET = REFRESH;
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it("HS256 signed token verifies correctly", async () => {
    const jwtService = new JwtService({
      secret: ACCESS,
      signOptions: { algorithm: "HS256", issuer: "denotenman-api", audience: "denotenman-client" },
    });

    const token = await jwtService.signAsync(
      { sub: "uid", email: "u@e.com", role: "customer" },
      { expiresIn: 900 },
    );

    const decoded = jwtService.verify<{ sub: string }>(token, {
      algorithms: ["HS256"],
      secret: ACCESS,
    });
    expect(decoded.sub).toBe("uid");
  });

  it("token signed with refresh-secret rejected by access-secret verifier", async () => {
    const refreshJwt = new JwtService({
      secret: REFRESH,
      signOptions: { algorithm: "HS256" },
    });

    const token = await refreshJwt.signAsync({ sub: "uid", email: "u@e.com", role: "customer" });

    const verifyWithWrongSecret = () =>
      new JwtService({ secret: ACCESS }).verify<{ sub: string }>(token, {
        algorithms: ["HS256"],
        secret: ACCESS,
      });
    expect(verifyWithWrongSecret).toThrow();
  });
});
