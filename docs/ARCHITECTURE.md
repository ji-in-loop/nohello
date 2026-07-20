# Architecture

```
skills/nohello/SKILL.md      Claude Agent Skill packaging — documents the behavior for
                              Claude-driven use, points to the engine for real automation.

packages/core                 @nohello/core — platform-agnostic engine. No knowledge of Slack,
  ├─ detector.ts               Teams, or any transport.
  ├─ config.ts                 - detector.ts: is this message "greeting-only"?
  ├─ responses.ts               - config.ts: config shape, defaults, validation
  ├─ store.ts                  - responses.ts: tone templates + custom template rendering
  └─ engine.ts                 - store.ts: PendingStore interface + in-memory default
                                 - engine.ts: NoHelloEngine — orchestrates the above, owns timers

packages/slack-adapter         @nohello/slack — Slack Bolt wiring around the engine.
packages/teams-adapter         @nohello/teams — Bot Framework wiring around the engine.
examples/generic-webhook       Minimal HTTP-in/HTTP-out reference for any other platform.
docs/                          Configuration, integration guides, this file.
```

## Data flow

```
inbound message
      │
      ▼
NoHelloEngine.ingestMessage({conversationId, userId, text, ...})
      │
      ├─ not greeting-only, no pending timer for this user+conversation ──▶ { action: 'no-op' }
      │
      ├─ not greeting-only, pending timer exists ──▶ cancel timer, clear store
      │                                                { action: 'cleared', reason: 'follow-up-received' }
      │
      ├─ greeting-only, still in cooldown from a recent nudge ──▶ { action: 'cleared', reason: 'cooldown-active' }
      │
      └─ greeting-only, not in cooldown ──▶ (re)schedule a timer for waitSeconds
                                              { action: 'scheduled', nudgeInMs }
                                                      │
                                        (waitSeconds later, uncancelled)
                                                      ▼
                                          renderResponse(tone, {name, waitSeconds})
                                                      │
                                                      ▼
                                            onNudge({conversationId, userId, text, ...})
                                                      │
                                                      ▼
                                        adapter sends the nudge into the chat platform
```

## Key design decisions

- **Engine owns timing, not detection alone.** `detectGreetingOnly` is a pure function
  (text + config → boolean), but "wait, and cancel if the real message shows up" is stateful —
  that state lives in `NoHelloEngine` + `PendingStore`, keyed by `${conversationId}:${userId}`.
- **`PendingStore` is pluggable.** The bundled `InMemoryPendingStore` is fine for one process.
  A horizontally scaled bot should implement the same interface against Redis (or similar) so
  all instances agree on pending/cooldown state — see
  [`docs/CONFIGURATION.md`](CONFIGURATION.md#scaling-beyond-a-single-process).
- **`resolveConfig` enables multi-tenant config**, e.g. per-workspace settings loaded from a
  database, without needing one `NoHelloEngine` instance per tenant.
- **Adapters are thin.** They translate platform events into `IncomingMessage` and platform send
  calls into `onNudge` — no detection or timing logic duplicated per platform. Teams needs extra
  bookkeeping (a `ConversationReference` per conversation) purely because Bot Framework requires
  "continuing" a conversation to message outside an active turn; Slack doesn't have that
  restriction, so `@nohello/slack` is simpler.
- **The Claude Skill (`skills/nohello/SKILL.md`) documents behavior, not a runtime.** A SKILL.md
  file can't itself hold a 90-second timer across model turns. It exists so (a) Claude, when
  drafting a reply to a lone "Hi", follows the same tone/response conventions as the automated
  engine, and (b) anyone using an AI coding agent to integrate this library gets the config
  schema and wiring pattern without having to read the source first.
