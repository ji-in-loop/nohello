# Terminal chat example

The fastest way to try #nohello locally — no Slack workspace, Teams tenant, or any chat
platform account needed. You play the greeter in your terminal; the bot nudges you.

```bash
npm install
npm run build --workspace nohello-example-terminal-chat
NOHELLO_WAIT_SECONDS=5 NOHELLO_TONE=satirical npm run start --workspace nohello-example-terminal-chat
```

Then:

```text
you> hi
   [engine: scheduled — nudge in 5s unless you follow up]

🤖 nohello-bot: Achievement unlocked: "Hello". Now for the legendary "Hello + Question" combo — give it a shot!
```

Type a real question within the wait window instead, and the nudge is silently cancelled —
exactly the behavior a Slack or Teams deployment would have:

```text
you> hello
   [engine: scheduled — nudge in 5s unless you follow up]
you> can you review PR #42 today?
   [engine: cleared (follow-up-received)]
```

Configuration is the same env vars as every other integration: `NOHELLO_WAIT_SECONDS`,
`NOHELLO_TONE` (`professional` | `friendly` | `satirical` | `custom`),
`NOHELLO_COOLDOWN_SECONDS`, and `NOHELLO_CUSTOM_TEMPLATE` (for `custom` tone; supports `{name}`
and `{waitSeconds}`).
