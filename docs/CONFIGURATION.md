# Configuration

`@nohello/core` (and every adapter built on it) is configured through a single `NoHelloConfig`
object. See [`packages/core/src/config.ts`](../packages/core/src/config.ts) for the canonical
types and defaults.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Master on/off switch. When `false`, `ingestMessage()` is a no-op. |
| `waitSeconds` | `number` | `90` | Seconds to wait, after a greeting-only message, for the sender's real question before nudging. |
| `tone` | `'professional' \| 'friendly' \| 'satirical' \| 'custom'` | `'professional'` | Which template set renders the nudge. |
| `customTemplate` | `string` | — | Required when `tone` is `'custom'`. Supports `{name}` and `{waitSeconds}` placeholders. |
| `cooldownSeconds` | `number` | `600` | After a nudge is sent to a user in a conversation, suppress further nudges to them there for this long. |
| `mentionUser` | `boolean` | `true` | Hint to adapters that the nudge should @-mention the sender (adapters decide how to apply this). |
| `extraGreetingPhrases` | `string[]` | — | Additional greeting openers to treat like "hi"/"hello". |
| `extraSmalltalkPhrases` | `string[]` | — | Additional no-content phrases to treat like "how are you". |
| `maxGreetingWords` | `number` | `8` | A message longer than this is never considered greeting-only, no matter its content. |
| `maxLeftoverWords` | `number` | `2` | Words allowed to remain (e.g. a name) after scrubbing greeting/small-talk phrases before a message stops counting as greeting-only. |

## Setting configuration

```ts
import { NoHelloEngine } from '@nohello/core';

const engine = new NoHelloEngine({
  config: {
    waitSeconds: 45,
    tone: 'satirical',
    cooldownSeconds: 1800,
  },
  onNudge: async (nudge) => {
    /* send nudge.text into your chat platform */
  },
});
```

Unset fields fall back to `DEFAULT_CONFIG`. Invalid values (e.g. `waitSeconds: 0`, or
`tone: 'custom'` without a `customTemplate`) throw synchronously from the `NoHelloEngine`
constructor, so misconfiguration fails fast at boot rather than silently misbehaving later.

## Per-team / per-user configuration (enterprise use)

A single bot process often needs different settings per workspace, channel, or user — e.g. one
team wants a 30-second wait with a satirical tone, another wants 5 minutes and strictly
professional. Pass `resolveConfig` instead of (or in addition to) a static `config`:

```ts
const engine = new NoHelloEngine({
  config: { waitSeconds: 90, tone: 'professional' }, // fallback defaults
  resolveConfig: async (message) => {
    const teamSettings = await settingsStore.getForConversation(message.conversationId);
    return teamSettings; // partial overrides, merged over `config`
  },
  onNudge: async (nudge) => { /* ... */ },
});
```

`resolveConfig` is awaited on every inbound message, so keep it fast (cache your settings
lookup) — it sits on the hot path for every message the bot sees, not just greetings.

## Custom tone template

```ts
{
  tone: 'custom',
  customTemplate: 'Hey {name} — what do you need? (waited {waitSeconds}s so far)',
}
```

`{name}` is replaced with the best-effort name/address term extracted from the greeting (e.g.
"Hi Bala" → `Bala`), or an empty string if none was present. `{waitSeconds}` is replaced with
the configured wait.

## Scaling beyond a single process

The default `InMemoryPendingStore` keeps pending timers and cooldown state in the bot process's
memory. That's fine for a single instance. If you run multiple instances behind a load balancer
(common for Teams/Slack bots at enterprise scale), implement the `PendingStore` interface
([`packages/core/src/store.ts`](../packages/core/src/store.ts)) against Redis or another shared
store, and pass it as `store` in `NoHelloEngineOptions`.

**Be precise about what this does and doesn't buy you.** A shared store gives every instance the
same view of who's pending a nudge and who's in cooldown, which prevents the obvious failure
mode — two instances both nudging the same user for the same greeting. It is **not** high
availability for the nudge itself. The `setTimeout` that actually waits out `waitSeconds` lives
in the local memory of whichever process handled the greeting (`NoHelloEngine`'s internal
`timers` map is never written to the shared store). If that process crashes or restarts before
the timer fires, nothing else notices: the entry sits in the shared store marked "pending"
forever, and the nudge is silently dropped — there is no other instance polling for orphaned
entries to pick up and retry.

In practice this means: fine for reducing duplicate nudges across a fleet, but the delivery
guarantee for any single nudge is still "best effort, lost on a crash at the wrong moment," not
"will eventually fire." If you need the latter, the durable-scheduling piece (e.g. a delayed job
queue that survives process restarts) has to live outside this library — `NoHelloEngine` doesn't
persist its timers anywhere.
