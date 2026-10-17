import { Lock, type ILock } from "@/backend/models/Lock";

/**
 * Takes `key` for `holder`. True when we hold it (newly or already). Works on
 * any MongoDB-compatible store because only an insert with a fixed _id decides
 * the winner, never a read-then-write.
 */
export async function acquireLock(key: string, holder: string): Promise<boolean> {
  try {
    await Lock.create({ _id: key, holder });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    const cur = await Lock.findById(key).lean<ILock>();
    return cur?.holder === holder;
  }
}

/** Releases `key` only if `holder` still holds it. */
export async function releaseLock(key: string, holder: string) {
  await Lock.deleteOne({ _id: key, holder });
}

/** Clears a lock whose holder no longer applies (checked by the caller). */
export async function clearStaleLock(key: string, staleHolder: string) {
  await Lock.deleteOne({ _id: key, holder: staleHolder });
}

export async function lockHolder(key: string) {
  return (await Lock.findById(key).lean<ILock>())?.holder ?? null;
}
