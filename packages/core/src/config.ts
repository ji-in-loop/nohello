export type Tone = 'professional' | 'friendly' | 'satirical' | 'custom';

export const VALID_TONES: readonly Tone[] = ['professional', 'friendly', 'satirical', 'custom'];

export interface NoHelloConfig {
  /** Master on/off switch. When false, ingestMessage() is a no-op. */
  enabled: boolean;
  /** How long to wait, after a greeting-only message, for the sender to follow up with their real ask. */
  waitSeconds: number;
  /** Which template set to render the nudge from. */
  tone: Tone;
  /** Required when tone === 'custom'. Supports {name} and {waitSeconds} placeholders. */
  customTemplate?: string;
  /** Once a nudge is sent to a user in a conversation, suppress further nudges to them there for this many seconds. */
  cooldownSeconds: number;
  /** Hint to adapters that the nudge should @-mention the sender. */
  mentionUser: boolean;
  /** Additional greeting openers to treat like "hi"/"hello" (merged with the built-in list). */
  extraGreetingPhrases?: string[];
  /** Additional no-content small-talk phrases to treat like "how are you" (merged with the built-in list). */
  extraSmalltalkPhrases?: string[];
  /** A message longer than this many words is never considered greeting-only, regardless of content. */
  maxGreetingWords: number;
  /** Words left over after stripping greeting/small-talk phrases (e.g. a name) still allowed before the message counts as substantive. */
  maxLeftoverWords: number;
}

export const DEFAULT_CONFIG: NoHelloConfig = {
  enabled: true,
  waitSeconds: 90,
  tone: 'professional',
  cooldownSeconds: 600,
  mentionUser: true,
  maxGreetingWords: 8,
  maxLeftoverWords: 2,
};

export function resolveNoHelloConfig(overrides?: Partial<NoHelloConfig>): NoHelloConfig {
  const config: NoHelloConfig = { ...DEFAULT_CONFIG, ...overrides };
  validateNoHelloConfig(config);
  return config;
}

export function validateNoHelloConfig(config: NoHelloConfig): void {
  if (!VALID_TONES.includes(config.tone)) {
    throw new Error(`nohello: tone must be one of ${VALID_TONES.join(', ')}, got "${config.tone}"`);
  }
  if (!Number.isFinite(config.waitSeconds) || config.waitSeconds <= 0) {
    throw new Error(`nohello: waitSeconds must be a positive number, got ${config.waitSeconds}`);
  }
  if (!Number.isFinite(config.cooldownSeconds) || config.cooldownSeconds < 0) {
    throw new Error(`nohello: cooldownSeconds must be zero or a positive number, got ${config.cooldownSeconds}`);
  }
  if (!Number.isFinite(config.maxGreetingWords) || config.maxGreetingWords <= 0) {
    throw new Error(`nohello: maxGreetingWords must be a positive number, got ${config.maxGreetingWords}`);
  }
  if (!Number.isFinite(config.maxLeftoverWords) || config.maxLeftoverWords < 0) {
    throw new Error(`nohello: maxLeftoverWords must be zero or a positive number, got ${config.maxLeftoverWords}`);
  }
  if (config.tone === 'custom' && !config.customTemplate?.trim()) {
    throw new Error('nohello: customTemplate is required when tone is "custom"');
  }
}
