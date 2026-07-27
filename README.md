# nohello

[![CI](https://github.com/ji-in-loop/nohello/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ji-in-loop/nohello/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ji-in-loop/nohello/branch/main/graph/badge.svg)](https://codecov.io/gh/ji-in-loop/nohello)
[![Known Vulnerabilities](https://snyk.io/test/github/ji-in-loop/nohello/badge.svg)](https://snyk.io/test/github/ji-in-loop/nohello)
[![License: MIT](https://img.shields.io/github/license/ji-in-loop/nohello)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](tsconfig.base.json)
[![npm workspaces](https://img.shields.io/badge/npm-workspaces-CB3837?logo=npm&logoColor=white)](package.json)

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

### Try it in 30 seconds (no chat platform needed)

```bash
NOHELLO_WAIT_SECONDS=5 NOHELLO_TONE=satirical npm run start --workspace nohello-example-terminal-chat
```

Type a bare `hi`, wait 5 seconds, get nudged. Type a real question before the timer elapses
and the nudge is cancelled. See [`examples/terminal-chat`](examples/terminal-chat).

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
