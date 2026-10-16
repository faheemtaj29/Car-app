import { AccountingCounter } from "@/backend/models/Accounting";

/**
 * Next number in a named yearly sequence ("BOOKING:2026" → 1, 2, 3…).
 * Two first-ever calls can race to create the counter; the loser gets a
 * duplicate-key error, so retry once the counter exists.
 */
export async function nextSequence(key: string): Promise<number> {
  for (let attempt = 0; ; attempt++) {
    try {
      const c = await AccountingCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
      return c.seq as number;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000 || attempt >= 3) throw e;
    }
  }
}
