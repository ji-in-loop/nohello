# Integrations

`@nohello/core` is transport-agnostic: feed it `{ conversationId, userId, text, ... }` for every
inbound message, and it tells you when to call your platform's send-message API with a rendered
nudge. Every integration below is the same three steps:

1. Get inbound messages from the platform into `engine.ingestMessage(...)`.
2. Implement `onNudge` to call the platform's "send message" API.
3. For platforms that can't send a message outside of an active request/turn (Teams), capture
   enough context on each inbound message to re-open the conversation later.

## Slack — supported today

Use [`@nohello/slack`](../packages/slack-adapter). `registerNoHello(app, options)` wires a Bolt
`app.message()` listener into the engine and posts nudges with `chat.postMessage`. See
[`packages/slack-adapter/README.md`](../packages/slack-adapter/README.md) for full setup
(scopes, event subscriptions, Socket Mode vs. HTTP).

## Microsoft Teams — supported today

Use [`@nohello/teams`](../packages/teams-adapter). `createNoHelloBot(adapter, botAppId, options)`
returns a Bot Framework `ActivityHandler`. Teams requires "continuing" a conversation to send a
message outside of an active turn, so the adapter stores a `ConversationReference` per
conversation on every inbound message and uses `adapter.continueConversationAsync` to deliver
nudges. See [`packages/teams-adapter/README.md`](../packages/teams-adapter/README.md).

## Zoom Team Chat

Zoom doesn't have a first-party `@nohello/zoom` package yet, but it fits the same pattern as
Slack: Zoom's [Team Chat Chatbot](https://developers.zoom.us/docs/team-chat-apps/chatbots/) apps
receive inbound messages via a webhook (`bot_notification` events) and send messages back with
the Chatbot Messages REST API using an app-scoped token.

1. Create a **Chatbot** app in the [Zoom App Marketplace](https://marketplace.zoom.us/).
2. Point its **Bot Endpoint URL** at a route in your service (e.g. reuse the
   [generic-webhook example](../examples/generic-webhook)'s `/inbound` shape, adapted to Zoom's
   payload).
3. In that route, map Zoom's webhook payload to `IncomingMessage` — `conversationId` from
   `payload.channelId` (or the 1:1 chat id), `userId` from `payload.userId`, `text` from
   `payload.cmd`/`content.body` (depending on message type) — and call `engine.ingestMessage`.
4. In `onNudge`, POST to Zoom's `https://api.zoom.us/v2/im/chat/messages` (or the chatbot
   messages endpoint for your app type) with an OAuth token for your app, addressed to
   `nudge.conversationId`.

Because this is an HTTP-in/HTTP-out integration with no proactive-messaging quirks (Zoom allows
sending at any time with a valid token, similar to Slack), the
[generic-webhook example](../examples/generic-webhook) is a closer starting point than the Teams
adapter.

## LinkedIn — not generally available

Worth flagging honestly: LinkedIn does not offer a public API for third-party bots to send and
receive arbitrary 1:1 or group chat messages the way Slack, Teams, or Zoom do. Its messaging
APIs are restricted to specific partner programs (e.g. Talent Solutions, Marketing/Conversation
Ads via approved partners) and require a LinkedIn partnership, not just a developer account.

If you have access to one of those partner APIs, the same pattern still applies — map its
inbound message webhook to `IncomingMessage` and its send-message call to `onNudge` — but there
is no self-serve integration to document here. For a general LinkedIn Messaging bot outside an
approved partnership, there currently isn't a supported path.

## Any other chat engine

If a platform gives you (a) a way to be notified of new messages — webhook, WebSocket, polling —
and (b) an API call to send a message into a conversation, it fits this library. Copy
[`examples/generic-webhook`](../examples/generic-webhook) as a starting point:

```ts
import { NoHelloEngine } from '@nohello/core';

const engine = new NoHelloEngine({
  config: { waitSeconds: 90, tone: 'professional' },
  onNudge: async (nudge) => {
    await yourPlatformSdk.sendMessage(nudge.conversationId, nudge.text);
  },
});

yourPlatformSdk.onMessage(async (event) => {
  await engine.ingestMessage({
    conversationId: event.conversationId,
    userId: event.senderId,
    userName: event.senderDisplayName,
    text: event.text,
  });
});
```

If your platform can't send messages outside of an active request/callback (like Teams), follow
the `@nohello/teams` pattern: capture whatever context object the platform gives you per
conversation, and hold onto it so `onNudge` — which fires later, off the platform's own event
loop — has something to send through.
