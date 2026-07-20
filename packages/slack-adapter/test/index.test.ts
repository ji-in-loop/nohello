import { describe, expect, it, vi } from 'vitest';
import type { App } from '@slack/bolt';
import { registerNoHello } from '../src/index.js';

type MessageHandler = (args: { message: unknown; next?: () => Promise<void> }) => Promise<void>;

function createFakeApp() {
  let handler: MessageHandler | undefined;
  const postMessage = vi.fn().mockResolvedValue(undefined);
  const app = {
    message: (cb: MessageHandler) => {
      handler = cb;
    },
    client: { chat: { postMessage } },
  };

  return {
    app: app as unknown as App,
    postMessage,
    dispatch: async (message: unknown) => {
      if (!handler) throw new Error('handler was never registered — registerNoHello should call app.message()');
      await handler({ message, next: async () => {} });
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('registerNoHello', () => {
  it('ingests a plain greeting-only message and eventually posts a nudge to the same channel', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, { config: { waitSeconds: 0.02, cooldownSeconds: 0 } });

    await dispatch({ channel: 'c1', user: 'u1', text: 'hi', ts: '1700000000.000100' });
    await sleep(100);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0]).toMatchObject({ channel: 'c1' });
    engine.dispose();
  });

  it('prepends an @-mention when mentionUser is true (the default)', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, { config: { waitSeconds: 0.02, cooldownSeconds: 0 } });

    await dispatch({ channel: 'c1', user: 'u1', text: 'hi', ts: '1' });
    await sleep(100);

    const text = postMessage.mock.calls[0][0].text as string;
    expect(text.startsWith('<@u1>')).toBe(true);
    engine.dispose();
  });

  it('omits the mention when mentionUser is false', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, {
      config: { waitSeconds: 0.02, cooldownSeconds: 0, mentionUser: false },
    });

    await dispatch({ channel: 'c1', user: 'u1', text: 'hi', ts: '1' });
    await sleep(100);

    const text = postMessage.mock.calls[0][0].text as string;
    expect(text.startsWith('<@')).toBe(false);
    engine.dispose();
  });

  it('does not treat an edited message (message_changed) as a new greeting', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, { config: { waitSeconds: 0.02 } });

    await dispatch({ channel: 'c1', user: 'u1', text: 'hi', subtype: 'message_changed', ts: '1' });
    await sleep(100);

    expect(postMessage).not.toHaveBeenCalled();
    engine.dispose();
  });

  it('does not treat a bot message as a greeting', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, { config: { waitSeconds: 0.02 } });

    await dispatch({ channel: 'c1', user: 'u1', text: 'hi', subtype: 'bot_message', ts: '1' });
    await sleep(100);

    expect(postMessage).not.toHaveBeenCalled();
    engine.dispose();
  });

  it('does treat a thread_broadcast message as a real user greeting', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, { config: { waitSeconds: 0.02, cooldownSeconds: 0 } });

    await dispatch({ channel: 'c1', user: 'u1', text: 'hi', subtype: 'thread_broadcast', ts: '1' });
    await sleep(100);

    expect(postMessage).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('does not nudge a message with real content', async () => {
    const { app, postMessage, dispatch } = createFakeApp();
    const engine = registerNoHello(app, { config: { waitSeconds: 0.02 } });

    await dispatch({ channel: 'c1', user: 'u1', text: 'Is the deploy pipeline down?', ts: '1' });
    await sleep(100);

    expect(postMessage).not.toHaveBeenCalled();
    engine.dispose();
  });
});
