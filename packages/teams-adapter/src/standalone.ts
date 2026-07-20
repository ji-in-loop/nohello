import express from 'express';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationServiceClientCredentialFactory,
} from 'botbuilder';
import type { Tone } from '@nohello/core';
import { createNoHelloBot } from './index.js';

const appId = process.env.MICROSOFT_APP_ID ?? '';
const appPassword = process.env.MICROSOFT_APP_PASSWORD ?? '';

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: appId,
  MicrosoftAppPassword: appPassword,
  MicrosoftAppType: process.env.MICROSOFT_APP_TYPE ?? 'MultiTenant',
  MicrosoftAppTenantId: process.env.MICROSOFT_APP_TENANT_ID,
});

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({}, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
  // eslint-disable-next-line no-console
  console.error('nohello Teams bot error:', error);
  await context.sendActivity('Sorry, something went wrong handling that message.');
};

const { handler } = createNoHelloBot(adapter, appId, {
  config: {
    waitSeconds: Number(process.env.NOHELLO_WAIT_SECONDS ?? 90),
    tone: (process.env.NOHELLO_TONE as Tone | undefined) ?? 'professional',
    cooldownSeconds: Number(process.env.NOHELLO_COOLDOWN_SECONDS ?? 600),
    customTemplate: process.env.NOHELLO_CUSTOM_TEMPLATE,
  },
});

const app = express();
app.use(express.json());

app.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await handler.run(context);
  });
});

const port = Number(process.env.PORT ?? 3978);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`nohello Teams bot listening on port ${port} (POST /api/messages)`);
});
