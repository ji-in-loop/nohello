import { App } from '@slack/bolt';
import type { Tone } from '@nohello/core';
import { registerNoHello } from './index.js';

const token = process.env.SLACK_BOT_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;
const appToken = process.env.SLACK_APP_TOKEN; // set to run in Socket Mode

if (!token || !signingSecret) {
  throw new Error(
    'Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET (and SLACK_APP_TOKEN to use Socket Mode) before starting the nohello Slack bot. See packages/slack-adapter/README.md.',
  );
}

const app = new App({
  token,
  signingSecret,
  socketMode: Boolean(appToken),
  appToken,
});

registerNoHello(app, {
  config: {
    waitSeconds: Number(process.env.NOHELLO_WAIT_SECONDS ?? 90),
    tone: (process.env.NOHELLO_TONE as Tone | undefined) ?? 'professional',
    cooldownSeconds: Number(process.env.NOHELLO_COOLDOWN_SECONDS ?? 600),
    customTemplate: process.env.NOHELLO_CUSTOM_TEMPLATE,
  },
});

const port = Number(process.env.PORT ?? 3000);

await app.start(port);
// eslint-disable-next-line no-console
console.log(`nohello Slack bot running (socketMode=${Boolean(appToken)}, port=${port})`);
