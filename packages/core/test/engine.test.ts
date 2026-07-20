import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoHelloEngine, type Nudge } from '../src/engine.js';
import { InMemoryPendingStore } from '../src/store.js';
import type { PendingEntry, PendingStore } from '../src/store.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps InMemoryPendingStore with an artificial delay to simulate a network-backed store.
 * `get` is deliberately slower than the other operations — that asymmetry is what widens the
 * window between "fireNudge reads an entry" and "fireNudge acts on it" enough for a real test to
 * land reliably inside it, the same way a genuinely slow network read would in production.
 */
class DelayedStore implements PendingStore {
  private readonly inner = new InMemoryPendingStore();

  constructor(
    private readonly getDelayMs: number,
    private readonly otherDelayMs: number,
  ) {}

  private async delay<T>(value: T, ms: number): Promise<T> {
    await sleep(ms);
    return value;
  }

  async get(key: string): Promise<PendingEntry | undefined> {
    return this.delay(await this.inner.get(key), this.getDelayMs);
  }

  async set(key: string, entry: PendingEntry): Promise<void> {
    return this.delay(await this.inner.set(key, entry), this.otherDelayMs);
  }

  async delete(key: string): Promise<void> {
    return this.delay(await this.inner.delete(key), this.otherDelayMs);
  }

  async getLastNudgeAt(key: string): Promise<number | undefined> {
    return this.delay(await this.inner.getLastNudgeAt(key), this.otherDelayMs);
  }

  async setLastNudgeAt(key: string, at: number): Promise<void> {
    return this.delay(await this.inner.setLastNudgeAt(key, at), this.otherDelayMs);
  }
}

describe('NoHelloEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules and eventually fires a nudge for a greeting-only message', async () => {
    const nudges: Nudge[] = [];
    const engine = new NoHelloEngine({
      config: { waitSeconds: 30, tone: 'professional' },
      onNudge: (nudge) => {
        nudges.push(nudge);
      },
      random: () => 0,
    });

    const result = await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi' });
    expect(result.action).toBe('scheduled');
    expect(nudges).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(nudges).toHaveLength(1);
    expect(nudges[0].conversationId).toBe('c1');
    expect(nudges[0].userId).toBe('u1');
    expect(nudges[0].text.length).toBeGreaterThan(0);
  });

  it('cancels the nudge when the user follows up with a real message before the timer fires', async () => {
    const nudges: Nudge[] = [];
    const engine = new NoHelloEngine({
      config: { waitSeconds: 30 },
      onNudge: (nudge) => {
        nudges.push(nudge);
      },
    });

    await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hello' });
    const followUp = await engine.ingestMessage({
      conversationId: 'c1',
      userId: 'u1',
      text: 'Can you review my PR when you get a chance?',
    });
    expect(followUp).toEqual({ action: 'cleared', reason: 'follow-up-received' });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(nudges).toHaveLength(0);
  });

  it('does not schedule anything for a message that is not greeting-only', async () => {
    const engine = new NoHelloEngine({ onNudge: () => {} });
    const result = await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'Is prod down?' });
    expect(result).toEqual({ action: 'no-op' });
  });

  it('respects the cooldown window and does not re-schedule a nudge too soon after the last one', async () => {
    const nudges: Nudge[] = [];
    const engine = new NoHelloEngine({
      config: { waitSeconds: 10, cooldownSeconds: 300 },
      onNudge: (nudge) => {
        nudges.push(nudge);
      },
    });

    await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi', timestamp: 0 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(nudges).toHaveLength(1);

    const second = await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi', timestamp: 20_000 });
    expect(second).toEqual({ action: 'cleared', reason: 'cooldown-active' });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(nudges).toHaveLength(1);
  });

  it('re-arms the timer if the sender greets again before the first nudge fires', async () => {
    const nudges: Nudge[] = [];
    const engine = new NoHelloEngine({
      config: { waitSeconds: 30 },
      onNudge: (nudge) => {
        nudges.push(nudge);
      },
    });

    await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi' });
    await vi.advanceTimersByTimeAsync(20_000);
    await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hello again' });

    await vi.advanceTimersByTimeAsync(20_000); // 40s total from first message, but only 20s since the re-greet
    expect(nudges).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(10_000); // now 30s since the re-greet
    expect(nudges).toHaveLength(1);
  });

  it('renders the custom template with placeholders substituted', async () => {
    const nudges: Nudge[] = [];
    const engine = new NoHelloEngine({
      config: { waitSeconds: 5, tone: 'custom', customTemplate: 'Yo {name}, ask away! (waited {waitSeconds}s)' },
      onNudge: (nudge) => {
        nudges.push(nudge);
      },
    });

    await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi Sam' });
    await vi.advanceTimersByTimeAsync(5_000);

    expect(nudges[0].text).toBe('Yo Sam, ask away! (waited 5s)');
  });

  it('does nothing when disabled', async () => {
    const engine = new NoHelloEngine({ config: { enabled: false }, onNudge: () => {} });
    const result = await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi' });
    expect(result).toEqual({ action: 'ignored' });
  });
});

// Uses real timers (small millisecond delays) rather than fake timers: these tests exercise
// genuine async interleaving between concurrent calls for the same key, which fake timers can't
// reproduce the same way.
describe('NoHelloEngine race safety', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('serializes runExclusive calls for the same key but lets different keys run concurrently', async () => {
    const engine = new NoHelloEngine({ onNudge: () => {} });
    const runExclusive = (
      engine as unknown as { runExclusive: <T>(key: string, task: () => Promise<T>) => Promise<T> }
    ).runExclusive.bind(engine);

    const order: string[] = [];
    const task = (label: string, ms: number) => async () => {
      order.push(`${label}:start`);
      await sleep(ms);
      order.push(`${label}:end`);
      return label;
    };

    // 'b' is queued behind 'a' for the same key, and is faster — if they were allowed to run
    // concurrently it would finish first. It must not even start until 'a' settles.
    const sameKey = Promise.all([runExclusive('k1', task('a', 20)), runExclusive('k1', task('b', 5))]);
    // A different key must not be blocked by 'k1's queue.
    const differentKey = runExclusive('k2', task('c', 1));

    const [[a, b], c] = await Promise.all([sameKey, differentKey]);

    // 'a' and 'b' share a key, so their relative order must be strictly serialized...
    const sameKeyOrder = order.filter((event) => event.startsWith('a') || event.startsWith('b'));
    expect(sameKeyOrder).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    // ...but 'c' (a different key, 1ms) isn't queued behind 'a' (same key, 20ms) — it finishes well before 'a' does.
    expect(order.indexOf('c:end')).toBeLessThan(order.indexOf('a:end'));
    expect([a, b, c]).toEqual(['a', 'b', 'c']);
  });

  it('does not lose a follow-up greeting that arrives while a same-key nudge is mid-flight', async () => {
    const nudges: Nudge[] = [];
    const engine = new NoHelloEngine({
      config: { waitSeconds: 0.03, cooldownSeconds: 0 }, // 30ms
      store: new DelayedStore(60, 2),
      onNudge: (nudge) => {
        nudges.push(nudge);
      },
    });

    await engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hi' });

    // The 30ms fire timer has now tripped and fireNudge is mid-flight, blocked on its slow
    // (60ms) store.get. Interject a second greeting from the same user here: without per-key
    // serialization, fireNudge's stale read goes on to delete the fresh entry this write
    // creates, and the second message's own later timer then finds nothing and silently exits.
    await sleep(70);
    const second = engine.ingestMessage({ conversationId: 'c1', userId: 'u1', text: 'hello again' });

    await second;
    await sleep(400); // let both nudge cycles fully drain

    expect(nudges).toHaveLength(2);
    expect(nudges.map((n) => n.originalMessage).sort()).toEqual(['hello again', 'hi']);
  });
});
