import { Injectable } from "@nestjs/common";
import argon2 from "argon2";

// Argon2id params matching seed.ts — memoryCost 47104 / timeCost 3 / parallelism 1.
const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 47104,
  timeCost: 3,
  parallelism: 1,
};

@Injectable()
export class ArgonHasher {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON_OPTIONS);
  }

  /**
   * Verify a plain-text password against a stored hash.
   *
   * Always-hash guard: when no real hash is available (unknown user), the
   * caller should pass a dummy hash obtained from hash("") so that timing
   * is identical to the known-user path — preventing user enumeration.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
