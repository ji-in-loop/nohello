export interface PendingEntry {
  conversationId: string;
  userId: string;
  userName?: string;
  originalMessage: string;
  name?: string;
  scheduledAt: number;
}

/**
 * Persists in-flight "waiting for the real question" state, keyed by `${conversationId}:${userId}`.
 * The bundled InMemoryPendingStore is fine for a single-process bot. For a horizontally scaled
 * deployment (multiple bot instances behind a load balancer), implement this interface against
 * Redis or similar so all instances see the same pending/cooldown state.
 *
 * Caveat: `NoHelloEngine` serializes `get`/`set`/`delete` calls for the same key *within one
 * process* (see `runExclusive` in engine.ts), which closes the obvious read-then-clobber race
 * for a single instance. It does not give you cross-instance atomicity — if two different bot
 * processes handle messages for the same key at nearly the same moment, their store calls can
 * still interleave. If your deployment can route the same conversation+user to different
 * instances concurrently, make your implementation's read-modify-write sequences atomic
 * (e.g. a Lua script or WATCH/MULTI in Redis) rather than plain get-then-set/delete.
 */
export interface PendingStore {
  get(key: string): Promise<PendingEntry | undefined>;
  set(key: string, entry: PendingEntry): Promise<void>;
  delete(key: string): Promise<void>;
  getLastNudgeAt(key: string): Promise<number | undefined>;
  setLastNudgeAt(key: string, at: number): Promise<void>;
}

export class InMemoryPendingStore implements PendingStore {
  private pending = new Map<string, PendingEntry>();
  private lastNudgeAt = new Map<string, number>();

  async get(key: string): Promise<PendingEntry | undefined> {
    return this.pending.get(key);
  }

  async set(key: string, entry: PendingEntry): Promise<void> {
    this.pending.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.pending.delete(key);
  }

  async getLastNudgeAt(key: string): Promise<number | undefined> {
    return this.lastNudgeAt.get(key);
  }

  async setLastNudgeAt(key: string, at: number): Promise<void> {
    this.lastNudgeAt.set(key, at);
  }
}
