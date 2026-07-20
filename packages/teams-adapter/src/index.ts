import { ActivityHandler, TurnContext, type ConversationReference, type Mention } from 'botbuilder';
import { NoHelloEngine, type IncomingMessage, type Nudge, type NoHelloEngineOptions } from '@nohello/core';

export interface RegisterNoHelloOptions extends Omit<NoHelloEngineOptions, 'onNudge'> {
  /** Defaults to proactively re-opening the conversation and posting the nudge there. */
  onNudge?: NoHelloEngineOptions['onNudge'];
  /**
   * Caps how many conversation references are held in memory at once (LRU-evicted). Each
   * conversation the bot has ever seen a message in adds one entry that otherwise lives forever,
   * so a long-running bot across many conversations needs a bound. Default: 10,000.
   */
  maxConversationReferences?: number;
}

const DEFAULT_MAX_CONVERSATION_REFERENCES = 10_000;

/** Inserts/refreshes `id` as most-recently-used, evicting the oldest entry once over `maxSize`. */
export function rememberConversationReference(
  store: Map<string, Partial<ConversationReference>>,
  id: string,
  reference: Partial<ConversationReference>,
  maxSize: number,
): void {
  store.delete(id); // re-insert to mark as most-recently-used (Map preserves insertion order)
  store.set(id, reference);
  if (store.size > maxSize) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    }
  }
}

/** The subset of BotFrameworkAdapter/CloudAdapter needed to send a message outside a turn. */
export interface ProactiveMessagingAdapter {
  continueConversationAsync(
    botId: string,
    reference: Partial<ConversationReference>,
    logic: (context: TurnContext) => Promise<void>,
  ): Promise<void>;
}

export interface NoHelloBot {
  handler: ActivityHandler;
  engine: NoHelloEngine;
}

/**
 * Wires @nohello/core into a Bot Framework ActivityHandler for Microsoft Teams. Conversation
 * references are captured on every turn so the default onNudge can proactively post the nudge
 * later, once the wait timer elapses — Teams (unlike Slack) requires re-opening the
 * conversation to send a message outside of an active turn.
 */
export function createNoHelloBot(
  adapter: ProactiveMessagingAdapter,
  botAppId: string,
  options: RegisterNoHelloOptions = {},
): NoHelloBot {
  const conversationReferences = new Map<string, Partial<ConversationReference>>();
  const maxConversationReferences = options.maxConversationReferences ?? DEFAULT_MAX_CONVERSATION_REFERENCES;

  const engine = new NoHelloEngine({
    ...options,
    onNudge:
      options.onNudge ??
      (async (nudge: Nudge) => {
        // Falls through silently if we've never captured a conversation reference for this
        // conversationId (e.g. the engine was fed a message via some path other than this
        // adapter's onMessage handler) — there is nowhere to proactively send the nudge.
        const reference = conversationReferences.get(nudge.conversationId);
        if (!reference) return;

        await adapter.continueConversationAsync(botAppId, reference, async (turnContext) => {
          const sender = reference.user;
          if (nudge.mentionUser && sender?.id && sender?.name) {
            const mentionText = `<at>${sender.name}</at>`;
            const mention: Mention = { type: 'mention', text: mentionText, mentioned: { id: sender.id, name: sender.name } };
            await turnContext.sendActivity({
              type: 'message',
              text: `${mentionText} ${nudge.text}`,
              entities: [mention],
            });
          } else {
            await turnContext.sendActivity(nudge.text);
          }
        });
      }),
  });

  const handler = new ActivityHandler();
  handler.onMessage(async (context, next) => {
    const conversationId = context.activity.conversation?.id;
    if (conversationId) {
      rememberConversationReference(
        conversationReferences,
        conversationId,
        TurnContext.getConversationReference(context.activity),
        maxConversationReferences,
      );
    }

    const userId = context.activity.from?.id;
    const text = context.activity.text;
    if (conversationId && userId && text) {
      const incoming: IncomingMessage = {
        conversationId,
        userId,
        userName: context.activity.from?.name,
        text,
        timestamp: context.activity.timestamp ? new Date(context.activity.timestamp).getTime() : undefined,
      };
      await engine.ingestMessage(incoming);
    }

    await next();
  });

  return { handler, engine };
}

export { NoHelloEngine } from '@nohello/core';
export type { NoHelloConfig, Nudge, Tone } from '@nohello/core';
