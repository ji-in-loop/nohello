# @nohello/core

Platform-agnostic detection, wait-timer, and tone-template engine for the
[#nohello](https://github.com/ji-in-loop/nohello) skill: detects chat messages that are just a
greeting ("hi", "hello", "hello \<name\>", "hi, how are you") with no actual question, waits a
configurable number of seconds for the sender's real ask, and — if it never shows up — renders a
nudge back in a configurable tone (professional, friendly, satirical, or your own custom
template).

No dependencies, no platform assumptions. Feed it messages, get back nudges to send — wiring it
into a specific chat engine is the job of an adapter like [`@nohello/slack`](https://www.npmjs.com/package/@nohello/slack)
or [`@nohello/teams`](https://www.npmjs.com/package/@nohello/teams), or your own integration
following the same pattern.

## Install

```bash
npm install @nohello/core
```

## Usage

```ts
import { NoHelloEngine } from '@nohello/core';

const engine = new NoHelloEngine({
  config: {
    waitSeconds: 90,      // how long to wait for the real question
    tone: 'friendly',     // 'professional' | 'friendly' | 'satirical' | 'custom'
    cooldownSeconds: 600, // don't re-nudge the same person too often
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

A message counts as "greeting-only" if, after stripping a greeting opener (`hi`, `hello`, `hey`,
`good morning`, ...), small-talk filler (`how are you`, `you there?`, `quick question`, ...), and
common Slack/Teams decoration tokens (`<@U01ABC>`, `<at>Name</at>`, `<#C01|general>`, `<!here>`),
no more than a couple of words are left over (e.g. just a name). A message with real content
attached — "Hi, can you review PR #123 today?" — is left alone. Need to handle something else
platform-specific (a Markdown code span, a bare URL)? Pass `preprocessText` in the config to run
your own cleanup before detection.

Full config reference, per-team overrides, and scaling notes:
[docs/CONFIGURATION.md](https://github.com/ji-in-loop/nohello/blob/main/docs/CONFIGURATION.md).

## License

MIT © Balajikumar Murugan
