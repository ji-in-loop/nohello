# Generic webhook example

Shows the minimum shape needed to plug `@nohello/core` into **any** chat engine: an inbound
HTTP endpoint that receives messages, and an outbound HTTP call that sends the nudge back.

```bash
export OUTBOUND_WEBHOOK_URL=https://example.com/your-platforms-send-endpoint
export NOHELLO_WAIT_SECONDS=30
export NOHELLO_TONE=friendly
npm run build --workspace nohello-example-generic-webhook
npm run start --workspace nohello-example-generic-webhook
```

Then feed it a message the same way your chat platform would deliver one via webhook:

```bash
curl -X POST http://localhost:4000/inbound \
  -H 'content-type: application/json' \
  -d '{"conversationId":"c1","userId":"u1","userName":"Bala","text":"hi"}'
```

Nothing responds immediately — after `NOHELLO_WAIT_SECONDS` with no follow-up message from
`u1` in `c1`, this process makes an HTTP POST to `OUTBOUND_WEBHOOK_URL` with the rendered nudge.
Send a follow-up message (any non-greeting text) from the same user/conversation before the
timer elapses and the nudge is cancelled.

See [`docs/INTEGRATIONS.md`](../../docs/INTEGRATIONS.md) for how this maps onto specific
platforms (Zoom Team Chat, LinkedIn, custom internal bots).

> **Security note:** `/inbound` has no authentication — it's a minimal example, not a deployable
> service. Anyone who can reach it can inject fake messages and trigger real POSTs to
> `OUTBOUND_WEBHOOK_URL`. Before running this pattern for real traffic, add whatever
> verification your source platform expects (an HMAC signature header, a shared secret, mTLS,
> etc.) and reject unverified requests before they reach `engine.ingestMessage`.
