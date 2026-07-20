# nohello

A configurable **#nohello** skill: detects chat messages that are just a greeting ("hi",
"hello", "hello \<name\>", "hi, how are you") with no actual question attached, waits a
configurable number of seconds for the sender's real ask, and — if it never shows up — sends a
configurable nudge back (professional, friendly, satirical, or your own custom tone).

Ships two ways:

- **[`skills/nohello`](skills/nohello/SKILL.md)** — a [Claude Agent Skill](https://agentskills.io)
  so Claude (in Claude Code, Claude.ai, or a Claude-powered bot) applies the same detection and
  tone conventions inline.
- **`@nohello/core`** — a small, platform-agnostic TypeScript engine, with reference adapters for
  Slack and Microsoft Teams, so any chat engine can run this as a real, timer-driven bot.

Background on the actual etiquette this implements: [nohello.org](https://www.nohello.org).

## Packages

| Package | Description |
| --- | --- |
| [`@nohello/core`](packages/core) | Detection, wait-timer, and tone-template engine. No platform dependencies. |
| [`@nohello/slack`](packages/slack-adapter) | Slack (Bolt) adapter, plus a ready-to-run standalone bot. |
| [`@nohello/teams`](packages/teams-adapter) | Microsoft Teams (Bot Framework) adapter, plus a ready-to-run standalone bot. |
| [`examples/generic-webhook`](examples/generic-webhook) | Minimal HTTP-in/HTTP-out reference for wiring up any other chat engine (Zoom, internal tools, etc.). |
| [`skills/nohello`](skills/nohello/SKILL.md) | Claude Agent Skill packaging of the same behavior. |

See [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) for platform-specific setup (Slack, Teams,
Zoom Team Chat, and an honest note on LinkedIn's API limitations),
[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) for the full config reference, including
per-team/per-user overrides and scaling beyond a single process, and
[`docs/PUBLISHING.md`](docs/PUBLISHING.md) for how CI and npm releases are wired up via GitHub
Actions.

## Quickstart

```bash
npm install
npm run build
npm test
```

```ts
import { NoHelloEngine } from '@nohello/core';

const engine = new NoHelloEngine({
  config: {
    waitSeconds: 90,          // how long to wait for the real question
    tone: 'friendly',         // 'professional' | 'friendly' | 'satirical' | 'custom'
    cooldownSeconds: 600,     // don't re-nudge the same person too often
  },
  onNudge: async (nudge) => {
    // send nudge.text into your chat platform, addressed to nudge.conversationId
  },
});

// call this for every inbound message from your chat platform
await engine.ingestMessage({
  conversationId: 'channel-123',
  userId: 'user-456',
  userName: 'Bala',
  text: 'hi',
});
// if no follow-up arrives within waitSeconds, onNudge fires with a rendered nudge
```

## How detection works

A message counts as "greeting-only" if, after stripping a greeting opener (`hi`, `hello`,
`hey`, `good morning`, ...) and small-talk filler (`how are you`, `you there?`, `quick
question`, ...), no more than a couple of words are left over (e.g. just a name). A message with
real content attached — "Hi, can you review PR #123 today?" — is left alone. Full algorithm in
[`packages/core/src/detector.ts`](packages/core/src/detector.ts); design rationale in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Development

This is an npm workspaces monorepo (Node 18+).

```bash
npm install                 # install all workspace deps
npm run build --workspaces  # build every package
npm run test --workspaces   # run @nohello/core's test suite (vitest)
npm run typecheck --workspaces
```

## License

[MIT](LICENSE) © Balajikumar Murugan
