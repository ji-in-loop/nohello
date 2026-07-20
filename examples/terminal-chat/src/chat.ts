/* eslint-disable no-console -- console output is this example's entire UI */
import readline from 'node:readline';
import { NoHelloEngine, type Tone } from '@nohello/core';

/**
 * Interactive local playground for the #nohello engine — you are the greeter, the bot nudges
 * you. No chat platform account needed. Every line you type is fed through the exact same
 * engine the Slack/Teams adapters use.
 */

const waitSeconds = Number(process.env.NOHELLO_WAIT_SECONDS ?? 10);
const tone = (process.env.NOHELLO_TONE as Tone | undefined) ?? 'friendly';
const cooldownSeconds = Number(process.env.NOHELLO_COOLDOWN_SECONDS ?? 30);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'you> ' });

const engine = new NoHelloEngine({
  config: {
    waitSeconds,
    tone,
    cooldownSeconds,
    customTemplate: process.env.NOHELLO_CUSTOM_TEMPLATE,
  },
  onNudge: (nudge) => {
    console.log(`\n🤖 nohello-bot: ${nudge.text}\n`);
    rl.prompt();
  },
});

console.log(`nohello terminal chat — waitSeconds=${waitSeconds}, tone=${tone}, cooldownSeconds=${cooldownSeconds}`);
console.log(`Type a bare "hi" and wait ${waitSeconds}s to get nudged. Follow up with a real`);
console.log('question before the timer elapses and the nudge is cancelled. Ctrl+C to exit.\n');
rl.prompt();

rl.on('line', async (line) => {
  const text = line.trim();
  if (text) {
    const result = await engine.ingestMessage({
      conversationId: 'terminal',
      userId: 'you',
      userName: process.env.USER,
      text,
    });
    let detail = '';
    if (result.action === 'scheduled') detail = ` — nudge in ${result.nudgeInMs / 1000}s unless you follow up`;
    if (result.action === 'cleared') detail = ` (${result.reason})`;
    console.log(`   [engine: ${result.action}${detail}]`);
  }
  rl.prompt();
});

rl.on('close', () => {
  engine.dispose();
  console.log('\nbye 👋');
  process.exit(0);
});
