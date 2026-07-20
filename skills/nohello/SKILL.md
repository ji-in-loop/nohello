---
name: nohello
description: Detects "greeting-only" chat messages (bare Hi/Hello/Hello <name>/Hi how are you, with no actual question), waits a configurable number of seconds for the sender's real ask, and — if it never arrives — sends a configurable nudge (professional, friendly, satirical, or custom tone) asking them to state their request. Use when a conversational agent needs to apply #nohello etiquette, when composing a reply to a message that is only a greeting, or when wiring up automated nudges for a chat bot (Slack, Teams, Zoom, LinkedIn, or any other chat engine).
when_to_use: Triggers on messages like "hi", "hello", "hello <name>", "hi, how are you", "you there?", or "quick question" that contain a greeting/small-talk opener and no substantive ask. Also applies when a user asks how to configure or integrate #nohello behavior into a bot.
argument-hint: "[wait_seconds] [tone: professional|friendly|satirical]"
license: MIT
---

# #nohello

Background: [nohello.org](https://www.nohello.org) and related sites document a common chat
anti-pattern — opening with a bare "Hi" or "Hello" and waiting for a reply before stating the
actual question. That forces synchronous back-and-forth and wastes the other person's time,
especially across time zones. This skill operationalizes the fix: wait briefly for the real
message, and if it doesn't show up, nudge the sender to just ask.

This skill has two modes of use:

1. **Inline, as Claude** — when you (Claude) are the one about to reply to a message that is
   *only* a greeting, follow the detection and response guidance below directly.
2. **As an automated bot** — for a persistent chat integration (Slack, Teams, Zoom, LinkedIn,
   or any other chat engine) that needs a real wait-then-nudge timer running outside of a single
   model turn, wire up the `@nohello/core` engine from this repository
   (https://github.com/ji-in-loop/nohello) instead of trying to reproduce the timer in-prompt.
   This SKILL.md and that package share the same detection rules and config shape, so behavior
   stays consistent whichever mode is in play.

## 1. Detect a greeting-only message

A message counts as greeting-only when, after removing:
- a greeting opener (`hi`, `hello`, `hey`, `hiya`, `howdy`, `greetings`, `good morning/afternoon/evening`, `yo`, `sup`, `what's up`, ...), and
- small-talk filler (`how are you`, `how's it going`, `hope you're well`, `long time no see`, `you there?`, `got a sec?`, `quick question`, ...), and
- a trailing name or address term (`Hello Bala`, `Hi team`),

there are no more than `max_leftover_words` words left (default `2`), and the original message
is no longer than `max_greeting_words` words (default `8`). A message with a real ask attached
— e.g. "Hi, can you review PR #123 today?" — is **not** greeting-only and should get a normal
reply, not a nudge.

The exact algorithm is implemented in [`packages/core/src/detector.ts`](../../packages/core/src/detector.ts)
(`detectGreetingOnly`) — treat that as the source of truth if this description and the code
ever disagree.

## 2. Wait for the real question

Default wait: **90 seconds** (`wait_seconds`, configurable). If the same sender, in the same
conversation, sends a substantive follow-up before the wait elapses, do nothing further — they
answered their own #nohello. If another greeting-only message arrives, restart the wait.

In-prompt (mode 1), you generally can't literally sleep for N seconds mid-turn — if you're
about to answer a lone "Hi", say so briefly and invite the real question rather than pretending
time has passed. Reserve the literal timer for mode 2 (the `@nohello/core` engine), which is
built for exactly this.

## 3. If the wait elapses with no follow-up, nudge

Render a reply in the configured tone. Keep it short, name the sender if known, and always end
by inviting the actual question — never scold without inviting the ask.

- **professional** — polite, efficient, no jokes. *"Hi Bala, thanks for reaching out — could you
  share what you need? Happy to help as soon as I have the full context."*
- **friendly** — warm, casual, an emoji is fine. *"Hey Bala 👋 go ahead and drop your question
  whenever, no need to wait for a reply first!"*
- **satirical** — playful ribbing about the #nohello anti-pattern, still kind. *"Achievement
  unlocked, Bala: 'Hello'. Now for the legendary 'Hello + Question' combo!"*
- **custom** — use the operator-supplied template verbatim, substituting `{name}` and
  `{waitSeconds}`.

The full template sets live in [`packages/core/src/responses.ts`](../../packages/core/src/responses.ts).

## Configuration

Same options in every integration (see [`packages/core/src/config.ts`](../../packages/core/src/config.ts)
and [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md) for full detail):

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master on/off switch |
| `waitSeconds` | `90` | How long to wait for the real question before nudging |
| `tone` | `"professional"` | `professional` \| `friendly` \| `satirical` \| `custom` |
| `customTemplate` | — | Required when `tone` is `custom`; supports `{name}`, `{waitSeconds}` |
| `cooldownSeconds` | `600` | Don't nudge the same sender in the same conversation again within this window |
| `maxGreetingWords` | `8` | Messages longer than this are never treated as greeting-only |
| `maxLeftoverWords` | `2` | Words allowed to remain (e.g. a name) after scrubbing greeting/small-talk phrases |

## Wiring this into a real bot

Don't reimplement the timer or templates by hand — install `@nohello/core` and call
`NoHelloEngine.ingestMessage()` for every inbound message; it tells you when to schedule a
nudge and calls your `onNudge` callback with the rendered text when the wait elapses uninterrupted:

```ts
import { NoHelloEngine } from '@nohello/core';

const engine = new NoHelloEngine({
  config: { waitSeconds: 60, tone: 'friendly' },
  onNudge: async (nudge) => {
    await postMessageToYourChatPlatform(nudge.conversationId, nudge.text);
  },
});

// on every inbound message from your chat platform's event handler:
await engine.ingestMessage({
  conversationId: event.channelId,
  userId: event.userId,
  userName: event.userDisplayName,
  text: event.text,
});
```

Reference adapters: [`packages/slack-adapter`](../../packages/slack-adapter) (Slack Bolt) and
[`packages/teams-adapter`](../../packages/teams-adapter) (Microsoft Bot Framework). For Zoom,
LinkedIn, or any other chat engine, see [`docs/INTEGRATIONS.md`](../../docs/INTEGRATIONS.md) —
the pattern is identical: forward inbound messages to `ingestMessage`, send whatever `onNudge`
gives you back.
