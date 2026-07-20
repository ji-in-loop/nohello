# @nohello/teams

Microsoft Teams adapter for the [#nohello](../../skills/nohello/SKILL.md) skill. Wires
[`@nohello/core`](../core) into a [Bot Framework](https://github.com/microsoft/botbuilder-js)
`ActivityHandler`. Unlike Slack, Teams requires re-opening ("continuing") a conversation to send
a message outside of an active turn — this adapter captures a `ConversationReference` on every
inbound message so the default nudge sender can proactively post once the wait timer elapses.

## Use as a library

```ts
import { CloudAdapter, ConfigurationBotFrameworkAuthentication, ConfigurationServiceClientCredentialFactory } from 'botbuilder';
import { createNoHelloBot } from '@nohello/teams';

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MICROSOFT_APP_ID,
  MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
});
const adapter = new CloudAdapter(new ConfigurationBotFrameworkAuthentication({}, credentialsFactory));

const { handler, engine } = createNoHelloBot(adapter, process.env.MICROSOFT_APP_ID!, {
  config: { waitSeconds: 60, tone: 'friendly' },
});

// hand `handler` to your existing HTTP route that calls adapter.process(req, res, ctx => handler.run(ctx))
```

### `mentionUser` behavior

With `mentionUser: true` (the default), nudges @-mention the sender using a proper Teams mention
entity built from the captured conversation reference. This needs both the sender's `id` *and*
`name` from the original activity — if the name is missing (`context.activity.from` has an id
but no name), the nudge **silently falls back to plain, un-mentioned text**. Teams virtually
always includes the name on user activities, so this rarely matters in practice, but if your
nudges aren't mentioning people, this fallback is the first thing to check.

## Run the standalone bot

This package also ships a ready-to-run bot (`src/standalone.ts`) driven by environment
variables.

### 1. Register an Azure Bot

1. In the [Azure Portal](https://portal.azure.com), create an **Azure Bot** resource (or use the
   [Teams Toolkit](https://learn.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
   for a guided flow).
2. Note the **Microsoft App ID** and generate a **client secret** (App Password).
3. Set the bot's messaging endpoint to `https://<your-host>/api/messages`.
4. Package and sideload the Teams app manifest pointing at that bot, or publish it to your org's
   Teams app catalog.

### 2. Configure

```bash
export MICROSOFT_APP_ID=...
export MICROSOFT_APP_PASSWORD=...
export MICROSOFT_APP_TENANT_ID=...      # required for single-tenant apps
export MICROSOFT_APP_TYPE=MultiTenant   # or SingleTenant
export NOHELLO_WAIT_SECONDS=90          # optional, default 90
export NOHELLO_TONE=professional        # professional | friendly | satirical | custom
export NOHELLO_COOLDOWN_SECONDS=600     # optional, default 600
export NOHELLO_CUSTOM_TEMPLATE=""       # required if NOHELLO_TONE=custom
export PORT=3978
```

### 3. Run

```bash
npm run build --workspace @nohello/teams
npm run start --workspace @nohello/teams
```

Expose the port with a tunnel (e.g. `devtunnel` or `ngrok`) during local development so Teams
can reach `/api/messages`.
