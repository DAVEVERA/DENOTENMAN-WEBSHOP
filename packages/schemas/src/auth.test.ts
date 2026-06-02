import { describe, it, expect } from "vitest";
import { LoginSchema, RegisterSchema, RefreshTokenSchema, UserSchema } from "./auth.js";

describe("LoginSchema", () => {
  it("accepts valid credentials", () => {
    const result = LoginSchema.parse({ email: "jan@voorbeeld.nl", password: "geheim" });
    expect(result.email).toBe("jan@voorbeeld.nl");
  });

  it("rejects invalid email", () => {
    expect(() => LoginSchema.parse({ email: "not-email", password: "geheim" })).toThrow();
  });

  it("rejects empty password", () => {
    expect(() => LoginSchema.parse({ email: "jan@voorbeeld.nl", password: "" })).toThrow();
  });
});

describe("RegisterSchema", () => {
  it("accepts valid registration", () => {
    const result = RegisterSchema.parse({
      email: "jan@voorbeeld.nl",
      password: "geheim123",
      firstName: "Jan",
      lastName: "Janssen",
    });
    expect(result.firstName).toBe("Jan");
  });

  it("rejects password shorter than 8 characters", () => {
    expect(() =>
      RegisterSchema.parse({
        email: "jan@voorbeeld.nl",
        password: "kort",
        firstName: "Jan",
        lastName: "Janssen",
      }),
    ).toThrow();
  });
});

describe("UserSchema", () => {
  it("accepts all valid roles", () => {
    const roles = ["owner", "admin", "staff", "customer"] as const;
    for (const role of roles) {
      const result = UserSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "jan@voorbeeld.nl",
        role,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      });
      expect(result.role).toBe(role);
    }
  });

  it("rejects unknown role", () => {
    expect(() =>
      UserSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "jan@voorbeeld.nl",
        role: "superadmin",
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }),
    ).toThrow();
  });
});

describe("RefreshTokenSchema", () => {
  it("accepts valid refresh token", () => {
    const result = RefreshTokenSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440001",
      userId: "550e8400-e29b-41d4-a716-446655440000",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      revokedAt: null,
      createdAt: new Date().toISOString(),
      userAgent: null,
      ipAddress: null,
    });
    expect(result.revokedAt).toBeNull();
  });
});
