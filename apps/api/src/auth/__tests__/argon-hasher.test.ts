import { describe, it, expect } from "vitest";
import { ArgonHasher } from "../argon-hasher";

describe("ArgonHasher", () => {
  const hasher = new ArgonHasher();

  it("produces a hash that is different from the plain-text input", async () => {
    const plain = "correcthorsebatterystaple";
    const hash = await hasher.hash(plain);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$argon2id")).toBe(true);
  });

  it("verify returns true for matching password", async () => {
    const plain = "s3cr3tP@ssw0rd";
    const hash = await hasher.hash(plain);
    expect(await hasher.verify(hash, plain)).toBe(true);
  });

  it("verify returns false for wrong password", async () => {
    const hash = await hasher.hash("correct");
    expect(await hasher.verify(hash, "incorrect")).toBe(false);
  });

  it("two hashes for the same input differ (unique salt per hash)", async () => {
    const plain = "samepassword";
    const h1 = await hasher.hash(plain);
    const h2 = await hasher.hash(plain);
    expect(h1).not.toBe(h2);
    expect(await hasher.verify(h1, plain)).toBe(true);
    expect(await hasher.verify(h2, plain)).toBe(true);
  });
});
