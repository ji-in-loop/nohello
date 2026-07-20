import { describe, expect, it, vi } from 'vitest';
import type { TurnContext, ConversationReference } from 'botbuilder';
import { createNoHelloBot, rememberConversationReference, type ProactiveMessagingAdapter } from '../src/index.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeMessageContext(overrides: Record<string, unknown> = {}) {
  return {
    activity: {
      type: 'message',
      conversation: { id: 'c1' },
      from: { id: 'u1', name: 'Bala' },
      recipient: { id: 'bot1' },
      channelId: 'msteams',
      serviceUrl: 'https://smba.trafficmanager.net/test',
      text: 'hi',
      timestamp: new Date(0).toISOString(),
      ...overrides,
    },
  } as unknown as TurnContext;
}

function createFakeAdapter() {
  const sendActivity = vi.fn().mockResolvedValue(undefined);
  const continueConversationAsync = vi.fn(
    async (_botId: string, _reference: unknown, logic: (context: TurnContext) => Promise<void>) => {
      await logic({ sendActivity } as unknown as TurnContext);
    },
  );
  return { adapter: { continueConversationAsync } as ProactiveMessagingAdapter, continueConversationAsync, sendActivity };
}

describe('rememberConversationReference', () => {
  it('evicts the oldest entry once over maxSize', () => {
    const store = new Map<string, Partial<ConversationReference>>();
    rememberConversationReference(store, 'a', { channelId: 'a' }, 2);
    rememberConversationReference(store, 'b', { channelId: 'b' }, 2);
    rememberConversationReference(store, 'c', { channelId: 'c' }, 2);

    expect(store.size).toBe(2);
    expect(store.has('a')).toBe(false);
    expect(store.has('b')).toBe(true);
    expect(store.has('c')).toBe(true);
  });

  it('refreshes recency on re-insert instead of evicting a recently-touched entry', () => {
    const store = new Map<string, Partial<ConversationReference>>();
    rememberConversationReference(store, 'a', { channelId: 'a' }, 2);
    rememberConversationReference(store, 'b', { channelId: 'b' }, 2);
    rememberConversationReference(store, 'a', { channelId: 'a-updated' }, 2); // touch 'a' again
    rememberConversationReference(store, 'c', { channelId: 'c' }, 2); // should evict 'b', not 'a'

    expect(store.has('a')).toBe(true);
    expect(store.get('a')).toEqual({ channelId: 'a-updated' });
    expect(store.has('b')).toBe(false);
    expect(store.has('c')).toBe(true);
  });

  it('never exceeds maxSize across many inserts', () => {
    const store = new Map<string, Partial<ConversationReference>>();
    for (let i = 0; i < 50; i++) {
      rememberConversationReference(store, `k${i}`, { channelId: `k${i}` }, 10);
    }
    expect(store.size).toBe(10);
  });
});

describe('createNoHelloBot', () => {
  it('ingests a message via the handler and eventually sends a mentioned nudge', async () => {
    const { adapter, continueConversationAsync, sendActivity } = createFakeAdapter();
    const { handler, engine } = createNoHelloBot(adapter, 'bot1', {
      config: { waitSeconds: 0.02, cooldownSeconds: 0 },
    });

    await handler.run(fakeMessageContext());
    await sleep(100);

    expect(continueConversationAsync).toHaveBeenCalledTimes(1);
    expect(sendActivity).toHaveBeenCalledTimes(1);
    const sentActivity = sendActivity.mock.calls[0][0];
    expect(sentActivity.text).toContain('<at>Bala</at>');
    expect(sentActivity.entities).toEqual([{ type: 'mention', text: '<at>Bala</at>', mentioned: { id: 'u1', name: 'Bala' } }]);
    engine.dispose();
  });

  it('escapes angle brackets in the sender name inside <at> markup', async () => {
    const { adapter, sendActivity } = createFakeAdapter();
    const { handler, engine } = createNoHelloBot(adapter, 'bot1', {
      config: { waitSeconds: 0.02, cooldownSeconds: 0 },
    });

    await handler.run(fakeMessageContext({ from: { id: 'u1', name: 'Bala <script>' } }));
    await sleep(100);

    const sentActivity = sendActivity.mock.calls[0][0];
    expect(sentActivity.text).toContain('<at>Bala &lt;script&gt;</at>');
    expect(sentActivity.text).not.toContain('<script>');
    expect(sentActivity.entities[0].text).toBe('<at>Bala &lt;script&gt;</at>');
    engine.dispose();
  });

  it('sends plain text with no mention entity when mentionUser is false', async () => {
    const { adapter, sendActivity } = createFakeAdapter();
    const { handler, engine } = createNoHelloBot(adapter, 'bot1', {
      config: { waitSeconds: 0.02, cooldownSeconds: 0, mentionUser: false },
    });

    await handler.run(fakeMessageContext());
    await sleep(100);

    expect(sendActivity).toHaveBeenCalledTimes(1);
    const sentActivity = sendActivity.mock.calls[0][0];
    expect(typeof sentActivity).toBe('string');
    expect(sentActivity).not.toContain('<at>');
    engine.dispose();
  });

  it('does not nudge a message with real content', async () => {
    const { continueConversationAsync, adapter } = createFakeAdapter();
    const { handler, engine } = createNoHelloBot(adapter, 'bot1', { config: { waitSeconds: 0.02 } });

    await handler.run(fakeMessageContext({ text: 'Is the deploy pipeline down?' }));
    await sleep(100);

    expect(continueConversationAsync).not.toHaveBeenCalled();
    engine.dispose();
  });

  it('silently does nothing when a nudge fires for a conversation whose reference was never captured', async () => {
    // Bypasses the handler entirely, so createNoHelloBot's internal conversationReferences map
    // never gets an entry for 'unknown-conv' — documents the default onNudge's no-op behavior.
    const { adapter, continueConversationAsync, sendActivity } = createFakeAdapter();
    const { engine } = createNoHelloBot(adapter, 'bot1', { config: { waitSeconds: 0.02, cooldownSeconds: 0 } });

    await engine.ingestMessage({ conversationId: 'unknown-conv', userId: 'u1', text: 'hi' });
    await sleep(100);

    expect(continueConversationAsync).not.toHaveBeenCalled();
    expect(sendActivity).not.toHaveBeenCalled();
    engine.dispose();
  });

  it('respects a custom maxConversationReferences bound — an evicted conversation silently drops its nudge', async () => {
    const { adapter, continueConversationAsync } = createFakeAdapter();
    const { handler, engine } = createNoHelloBot(adapter, 'bot1', {
      config: { waitSeconds: 0.02, cooldownSeconds: 0 },
      maxConversationReferences: 1,
    });

    await handler.run(fakeMessageContext({ conversation: { id: 'c1' }, from: { id: 'u1', name: 'Bala' } }));
    // c2 arrives second, evicting c1's reference under the maxConversationReferences: 1 bound.
    await handler.run(fakeMessageContext({ conversation: { id: 'c2' }, from: { id: 'u2', name: 'Sam' } }));
    await sleep(100);

    // Both timers elapsed, but c1's reference is gone — only c2's nudge actually goes through.
    expect(continueConversationAsync).toHaveBeenCalledTimes(1);
    engine.dispose();
  });
});
