# @nohello/slack

Slack adapter for the [#nohello](../../skills/nohello/SKILL.md) skill. Wires
[`@nohello/core`](../core) into a [Slack Bolt](https://slack.dev/bolt-js) app: every plain user
message is fed to the engine, and a greeting-only message that goes unanswered for
`waitSeconds` gets a nudge posted back to the same channel or DM.

## Use as a library

```ts
import { App } from '@slack/bolt';
import { registerNoHello } from '@nohello/slack';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

registerNoHello(app, {
  config: { waitSeconds: 60, tone: 'friendly' },
});

await app.start();
```

`registerNoHello` returns the underlying `NoHelloEngine`, so you can call `engine.dispose()` on
shutdown, or pass `resolveConfig` to look up per-workspace/per-channel settings (e.g. from a
database) on every message.

**`nudge.userName` is always `undefined` here.** Slack's message event only carries a user ID,
not a display name (Teams' event does include one, which is why `@nohello/teams` populates it).
If you need the sender's name — e.g. to log it, or to build your own `{name}`-style template
outside of `renderResponse`'s built-in extraction — resolve it yourself with
[`client.users.info`](https://api.slack.com/methods/users.info) and cache the result, then thread
it through a custom `onNudge`.

## Run the standalone bot

This package also ships a ready-to-run bot (`src/standalone.ts`) driven entirely by environment
variables — useful for trying the skill out or running it as its own service.

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch.
2. Under **OAuth & Permissions**, add these Bot Token Scopes: `chat:write`, `channels:history`,
   `groups:history`, `im:history`, `mpim:history`.
3. Under **Socket Mode**, enable it and generate an app-level token with the `connections:write`
   scope (starts with `xapp-`). This lets you run the bot without exposing a public HTTP endpoint.
4. Under **Event Subscriptions**, enable events and subscribe to: `message.channels`,
   `message.groups`, `message.im`, `message.mpim`.
5. Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-...`) and
   **Signing Secret**.

### 2. Configure

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
export SLACK_APP_TOKEN=xapp-...      # omit to run in HTTP mode instead of Socket Mode
export NOHELLO_WAIT_SECONDS=90       # optional, default 90
export NOHELLO_TONE=professional     # professional | friendly | satirical | custom
export NOHELLO_COOLDOWN_SECONDS=600  # optional, default 600
export NOHELLO_CUSTOM_TEMPLATE=""    # required if NOHELLO_TONE=custom, e.g. "Hey {name}, what's up? (waited {waitSeconds}s)"
```

### 3. Run

```bash
npm run build --workspace @nohello/slack
npm run start --workspace @nohello/slack
```
