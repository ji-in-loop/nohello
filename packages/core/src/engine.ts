import { DEFAULT_CONFIG, resolveNoHelloConfig, validateNoHelloConfig, type NoHelloConfig } from './config.js';
import { detectGreetingOnly } from './detector.js';
import { renderResponse } from './responses.js';
import { InMemoryPendingStore, type PendingEntry, type PendingStore } from './store.js';

export interface IncomingMessage {
  conversationId: string;
  userId: string;
  userName?: string;
  text: string;
  /** Epoch ms; defaults to Date.now() if omitted. Pass explicitly in tests for determinism. */
  timestamp?: number;
}

export interface Nudge {
  conversationId: string;
  userId: string;
  userName?: string;
  text: string;
  waitedSeconds: number;
  originalMessage: string;
}

export type IngestResult =
  | { action: 'ignored' }
  | { action: 'cleared'; reason: 'follow-up-received' | 'cooldown-active' }
  | { action: 'scheduled'; nudgeInMs: number }
  | { action: 'no-op' };

export interface NoHelloEngineOptions {
  /** Base config, merged with library defaults. */
  config?: Partial<NoHelloConfig>;
  /** Optional per-message override, e.g. to load per-team/per-user settings from a database. */
  resolveConfig?: (ctx: IncomingMessage) => Partial<NoHelloConfig> | Promise<Partial<NoHelloConfig>>;
  /** Called when a nudge is due to be sent. Wire this to your platform's "send message" call. */
  onNudge: (nudge: Nudge) => void | Promise<void>;
  /** Swap in a shared store (e.g. Redis-backed) for multi-instance deployments. Defaults to in-memory. */
  store?: PendingStore;
  /** Injectable RNG for deterministic tests. */
  random?: () => number;
}

function pendingKey(conversationId: string, userId: string): string {
  return `${conversationId}:${userId}`;
}

export class NoHelloEngine {
  private readonly baseConfig: Partial<NoHelloConfig>;
  private readonly resolveConfig?: NoHelloEngineOptions['resolveConfig'];
  private readonly onNudge: NoHelloEngineOptions['onNudge'];
  private readonly store: PendingStore;
  private readonly random: () => number;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  // Serializes ingestMessage/fireNudge per key so a follow-up message and an in-flight nudge
  // for the same conversation+user can never interleave their store reads/writes within this
  // process — see runExclusive(). Entries are removed once their chain drains, so this stays
  // bounded by "keys with work in flight right now", not "keys ever seen".
  private readonly keyQueues = new Map<string, Promise<void>>();

  constructor(options: NoHelloEngineOptions) {
    validateNoHelloConfig(resolveNoHelloConfig(options.config));
    this.baseConfig = options.config ?? {};
    this.resolveConfig = options.resolveConfig;
    this.onNudge = options.onNudge;
    this.store = options.store ?? new InMemoryPendingStore();
    this.random = options.random ?? Math.random;
  }

  /** Feed every incoming message through this. Safe to call for every message in a channel/DM. */
  async ingestMessage(message: IncomingMessage): Promise<IngestResult> {
    const overrides = await this.resolveConfig?.(message);
    const config = resolveNoHelloConfig({ ...this.baseConfig, ...overrides });

    if (!config.enabled || !message.text || !message.text.trim()) {
      return { action: 'ignored' };
    }

    const key = pendingKey(message.conversationId, message.userId);
    return this.runExclusive(key, () => this.applyMessage(key, message, config));
  }

  private async applyMessage(key: string, message: IncomingMessage, config: NoHelloConfig): Promise<IngestResult> {
    const detection = detectGreetingOnly(message.text, config);

    if (!detection.isGreetingOnly) {
      const existing = await this.store.get(key);
      if (existing) {
        this.clearTimer(key);
        await this.store.delete(key);
        return { action: 'cleared', reason: 'follow-up-received' };
      }
      return { action: 'no-op' };
    }

    const now = message.timestamp ?? Date.now();
    const lastNudgeAt = await this.store.getLastNudgeAt(key);
    if (lastNudgeAt !== undefined && now - lastNudgeAt < config.cooldownSeconds * 1000) {
      return { action: 'cleared', reason: 'cooldown-active' };
    }

    this.clearTimer(key);
    const entry: PendingEntry = {
      conversationId: message.conversationId,
      userId: message.userId,
      userName: message.userName,
      originalMessage: message.text,
      name: detection.name,
      scheduledAt: now,
    };
    await this.store.set(key, entry);

    const nudgeInMs = config.waitSeconds * 1000;
    const timer = setTimeout(() => {
      void this.runExclusive(key, () => this.fireNudge(key, config));
    }, nudgeInMs);
    this.timers.set(key, timer);

    return { action: 'scheduled', nudgeInMs };
  }

  /**
   * Runs `task` after any previously queued task for the same `key` has settled, so two calls
   * for the same conversation+user (e.g. a follow-up message racing an about-to-fire nudge)
   * never interleave their store reads/writes. Without this, a `fireNudge` that has already read
   * a pending entry can go on to delete/overwrite state a concurrently-arriving `applyMessage`
   * just wrote, silently dropping that message's nudge. This only serializes work within this
   * process — see the `PendingStore` doc comment for the remaining cross-instance caveat.
   */
  private runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.keyQueues.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.keyQueues.set(key, settled);
    void settled.then(() => {
      if (this.keyQueues.get(key) === settled) {
        this.keyQueues.delete(key);
      }
    });
    return result;
  }

  /** Cancels any pending timers. Call when shutting the bot process down. */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private async fireNudge(key: string, config: NoHelloConfig): Promise<void> {
    this.timers.delete(key);
    const entry = await this.store.get(key);
    if (!entry) {
      return; // cancelled by a follow-up message that arrived between scheduling and firing
    }
    await this.store.delete(key);
    await this.store.setLastNudgeAt(key, Date.now());

    const text = renderResponse(config.tone, { name: entry.name, waitSeconds: config.waitSeconds }, config.customTemplate, this.random);

    await this.onNudge({
      conversationId: entry.conversationId,
      userId: entry.userId,
      userName: entry.userName,
      text,
      waitedSeconds: config.waitSeconds,
      originalMessage: entry.originalMessage,
    });
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

export { DEFAULT_CONFIG };
