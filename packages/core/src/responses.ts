import type { Tone } from './config.js';

export interface ResponseContext {
  name?: string;
  waitSeconds: number;
}

function withName(prefix: string, name?: string): string {
  return name ? `${prefix} ${name}` : prefix;
}

const PROFESSIONAL_TEMPLATES: Array<(ctx: ResponseContext) => string> = [
  (ctx) =>
    `${withName('Hi', ctx.name)}, thanks for reaching out. Could you share what you need in your next message? That way I can help as soon as I see it, even if we're not both online at the same time.`,
  (ctx) =>
    `${withName('Hello', ctx.name)} — happy to help. Could you include your question or request up front next time? It saves a round trip for both of us.`,
  (ctx) =>
    `${withName('Hi', ctx.name)}, I noticed your message didn't include the details yet. Whenever you're ready, please send the full question and I'll get right on it.`,
];

const FRIENDLY_TEMPLATES: Array<(ctx: ResponseContext) => string> = [
  (ctx) => `${withName('Hey', ctx.name)} 👋 go ahead and drop your question whenever — no need to wait for a "hi" back first!`,
  (ctx) => `${withName('Hiya', ctx.name)}! I'm all ears — what's up? Feel free to just ask next time, saves us both a round trip 😊`,
  (ctx) => `${withName('Hey there', ctx.name)}, what can I help with? Just fire away with the question any time, greetings optional!`,
];

const SATIRICAL_TEMPLATES: Array<(ctx: ResponseContext) => string> = [
  (ctx) =>
    `Breaking news${ctx.name ? `, ${ctx.name}` : ''}: you have successfully said hello. Reports indicate the actual question is still at large. Please send it whenever convenient 🕵️`,
  (ctx) =>
    `Achievement unlocked${ctx.name ? `, ${ctx.name}` : ''}: "Hello". Now for the legendary "Hello + Question" combo — give it a shot!`,
  (ctx) =>
    `${withName('Ahem', ctx.name)}, this is the async messaging patrol. You've been cited for a hello-only transmission. Please submit your actual question to avoid further citations 😏`,
];

const TEMPLATES: Record<Exclude<Tone, 'custom'>, Array<(ctx: ResponseContext) => string>> = {
  professional: PROFESSIONAL_TEMPLATES,
  friendly: FRIENDLY_TEMPLATES,
  satirical: SATIRICAL_TEMPLATES,
};

function renderCustomTemplate(template: string, ctx: ResponseContext): string {
  const substituted = template.replaceAll('{name}', ctx.name ?? '').replaceAll('{waitSeconds}', String(ctx.waitSeconds));
  // Collapse runs of spaces/tabs left behind by an empty {name} substitution, per line, but
  // preserve deliberate newlines in multi-line templates instead of flattening them to one line.
  return substituted
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

export function renderResponse(
  tone: Tone,
  ctx: ResponseContext,
  customTemplate?: string,
  random: () => number = Math.random,
): string {
  if (tone === 'custom') {
    if (!customTemplate) {
      throw new Error('nohello: renderResponse called with tone "custom" but no customTemplate provided');
    }
    return renderCustomTemplate(customTemplate, ctx);
  }
  const variants = TEMPLATES[tone];
  if (!variants) {
    throw new Error(`nohello: unknown tone "${tone}"`);
  }
  const pick = variants[Math.floor(random() * variants.length)] ?? variants[0];
  return pick(ctx);
}
