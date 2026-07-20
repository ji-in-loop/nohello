import type { App } from '@slack/bolt';
import { NoHelloEngine, type IncomingMessage, type NoHelloEngineOptions } from '@nohello/core';

export interface RegisterNoHelloOptions extends Omit<NoHelloEngineOptions, 'onNudge'> {
  /** Defaults to posting the nudge back into the same channel/DM the greeting arrived in. */
  onNudge?: NoHelloEngineOptions['onNudge'];
}

interface PlainUserMessage {
  channel: string;
  user: string;
  text: string;
  ts?: string;
}

// Bolt's message event type is a union that includes edits, bot messages, joins/leaves, etc.
// We only care about plain user messages, so narrow with a runtime check instead of fighting
// the SDK's discriminated union in the type system.
function isPlainUserMessage(message: unknown): message is PlainUserMessage {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Record<string, unknown>;
  if (candidate.subtype) return false; // skip edits, bot messages, joins/leaves, etc.
  return typeof candidate.user === 'string' && typeof candidate.text === 'string' && typeof candidate.channel === 'string';
}

/**
 * Wires @nohello/core into a Slack Bolt app: every plain user message is fed to the engine,
 * and greeting-only messages that go unanswered get a nudge posted back to the same channel.
 */
export function registerNoHello(app: App, options: RegisterNoHelloOptions = {}): NoHelloEngine {
  const engine = new NoHelloEngine({
    ...options,
    onNudge:
      options.onNudge ??
      (async (nudge) => {
        await app.client.chat.postMessage({
          channel: nudge.conversationId,
          text: nudge.text,
        });
      }),
  });

  app.message(async ({ message, next }) => {
    if (isPlainUserMessage(message)) {
      // Slack's message event carries only a user ID, never a display name — unlike Teams,
      // there's no free `userName` here. `Nudge.userName` will be undefined for every Slack
      // nudge. If you need it (e.g. for logging), resolve it yourself with `client.users.info`
      // (cache the result — it's a separate API call per unique user) and pass a custom
      // `onNudge` that looks it up, or attach it to `nudge.userId` downstream.
      const incoming: IncomingMessage = {
        conversationId: message.channel,
        userId: message.user,
        text: message.text ?? '',
        timestamp: message.ts ? Math.round(Number(message.ts) * 1000) : undefined,
      };
      await engine.ingestMessage(incoming);
    }
    await next?.();
  });

  return engine;
}

export { NoHelloEngine } from '@nohello/core';
export type { NoHelloConfig, Nudge, Tone } from '@nohello/core';
