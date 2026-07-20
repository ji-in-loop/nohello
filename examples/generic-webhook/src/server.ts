import express from 'express';
import { NoHelloEngine, type Tone } from '@nohello/core';

/**
 * Generic reference integration: any chat engine that can (a) POST every inbound message to a
 * webhook and (b) accept an outbound "send message" HTTP call qualifies — this is the shape
 * Zoom Team Chat bots, internal enterprise chat tools, and most custom bot frameworks use.
 * Swap the two HTTP edges below for platform-specific SDK calls (see the Slack/Teams adapters
 * in packages/) and the engine usage stays identical.
 */

const outboundWebhookUrl = process.env.OUTBOUND_WEBHOOK_URL;
if (!outboundWebhookUrl) {
  throw new Error('Set OUTBOUND_WEBHOOK_URL to the endpoint that should receive rendered nudges.');
}

const engine = new NoHelloEngine({
  config: {
    waitSeconds: Number(process.env.NOHELLO_WAIT_SECONDS ?? 90),
    tone: (process.env.NOHELLO_TONE as Tone | undefined) ?? 'professional',
    cooldownSeconds: Number(process.env.NOHELLO_COOLDOWN_SECONDS ?? 600),
    customTemplate: process.env.NOHELLO_CUSTOM_TEMPLATE,
  },
  onNudge: async (nudge) => {
    await fetch(outboundWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: nudge.conversationId,
        userId: nudge.userId,
        text: nudge.text,
      }),
    });
  },
});

const app = express();
app.use(express.json());

interface InboundMessageBody {
  conversationId: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp?: number;
}

// SECURITY: this endpoint is intentionally unauthenticated to keep the example minimal. Anyone
// who can reach it can inject fake messages and trigger real outbound calls to
// OUTBOUND_WEBHOOK_URL. Before using this pattern for anything real, verify the request the same
// way your chat platform expects — e.g. an HMAC signature header (Slack, Zoom) or a shared
// secret — and reject anything that doesn't match before calling engine.ingestMessage.
app.post('/inbound', async (req, res) => {
  const body = req.body as Partial<InboundMessageBody>;
  if (!body.conversationId || !body.userId || typeof body.text !== 'string') {
    res.status(400).json({ error: 'conversationId, userId, and text are required' });
    return;
  }

  const result = await engine.ingestMessage({
    conversationId: body.conversationId,
    userId: body.userId,
    userName: body.userName,
    text: body.text,
    timestamp: body.timestamp,
  });

  res.json({ result });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`nohello generic-webhook example listening on port ${port} (POST /inbound)`);
});
