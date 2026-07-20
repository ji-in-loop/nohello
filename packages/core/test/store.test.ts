import { describe, expect, it } from 'vitest';
import { InMemoryPendingStore } from '../src/store.js';
import type { PendingEntry } from '../src/store.js';

const entry: PendingEntry = {
  conversationId: 'c1',
  userId: 'u1',
  originalMessage: 'hi',
  scheduledAt: 0,
};

describe('InMemoryPendingStore', () => {
  it('returns undefined for a key that was never set', async () => {
    const store = new InMemoryPendingStore();
    expect(await store.get('missing')).toBeUndefined();
  });

  it('round-trips set/get/delete for a pending entry', async () => {
    const store = new InMemoryPendingStore();
    await store.set('k1', entry);
    expect(await store.get('k1')).toEqual(entry);

    await store.delete('k1');
    expect(await store.get('k1')).toBeUndefined();
  });

  it('round-trips getLastNudgeAt/setLastNudgeAt', async () => {
    const store = new InMemoryPendingStore();
    expect(await store.getLastNudgeAt('k1')).toBeUndefined();

    await store.setLastNudgeAt('k1', 12345);
    expect(await store.getLastNudgeAt('k1')).toBe(12345);
  });

  it('keeps different keys independent', async () => {
    const store = new InMemoryPendingStore();
    await store.set('k1', entry);
    await store.setLastNudgeAt('k1', 999);

    expect(await store.get('k2')).toBeUndefined();
    expect(await store.getLastNudgeAt('k2')).toBeUndefined();
    expect(await store.get('k1')).toEqual(entry);
    expect(await store.getLastNudgeAt('k1')).toBe(999);
  });

  it('overwrites an existing entry for the same key', async () => {
    const store = new InMemoryPendingStore();
    await store.set('k1', entry);
    const updated: PendingEntry = { ...entry, originalMessage: 'hello again', name: 'Bala' };
    await store.set('k1', updated);
    expect(await store.get('k1')).toEqual(updated);
  });
});
