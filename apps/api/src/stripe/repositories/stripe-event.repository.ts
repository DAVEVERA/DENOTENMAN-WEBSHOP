import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma, StripeEvent } from "@denotenman/prisma";
import type { Stripe } from "stripe/cjs/stripe.core";

type InputJson = Prisma.InputJsonValue;

/** Prisma interactive-transaction client type. */
export type PrismaTransaction = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

export interface RecordEventResult {
  duplicate: boolean;
  event?: StripeEvent;
}

@Injectable()
export class StripeEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts a StripeEvent row inside the provided transaction (or creates its
   * own if none is supplied). On unique-key violation (P2002) — meaning the
   * event was already processed — returns `{ duplicate: true }` so the
   * controller can respond 200 idempotently without running side effects again.
   *
   * Per ADR 0008: this is the sole idempotency gate. The `id` field is the
   * Stripe event id, which is the dedup key.
   */
  async recordEvent(event: Stripe.Event, tx?: PrismaTransaction): Promise<RecordEventResult> {
    const client = tx ?? this.prisma;
    const payload = event as unknown as InputJson;

    try {
      const row = await client.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload,
        },
      });
      return { duplicate: false, event: row };
    } catch (err: unknown) {
      // P2002 = unique constraint violation — this event was already recorded.
      if (isPrismaUniqueError(err)) {
        return { duplicate: true };
      }
      throw err;
    }
  }
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
