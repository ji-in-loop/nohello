export interface GreetingDetectionConfig {
  maxGreetingWords: number;
  maxLeftoverWords: number;
  extraGreetingPhrases?: string[];
  extraSmalltalkPhrases?: string[];
}

export interface DetectionResult {
  isGreetingOnly: boolean;
  /** Best-effort name/address term left over after scrubbing, e.g. "Hi Bala" -> "Bala". */
  name?: string;
  matchedPhrases: string[];
}

// Openers that carry no content on their own — the classic #nohello "hi"/"hello".
const GREETING_PHRASES = [
  'good morning',
  'good afternoon',
  'good evening',
  'good day',
  'hey there',
  'hi there',
  'hello',
  'hiya',
  'howdy',
  'greetings',
  'hola',
  "what's up",
  'whats up',
  'hey',
  'hi',
  'yo',
  'sup',
];

// Phrases that read as pleasant but still leave the actual ask unstated.
const SMALLTALK_PHRASES = [
  'how are you doing',
  'how are you',
  "how's it going",
  'hows it going',
  'how is it going',
  'how you doing',
  'how are things',
  "hope you're doing well",
  'hope you are doing well',
  'hope youre doing well',
  'hope all is well',
  "hope you're well",
  'hope youre well',
  'long time no see',
  'are you there',
  'you there',
  'are you around',
  'you around',
  'are you free',
  'you free',
  'free to chat',
  'got a sec',
  'got a minute',
  'have a sec',
  'have a minute',
  'you got a sec',
  'you got a minute',
  'quick question',
];

// Address terms that can trail a greeting ("Hi team", "Hello everyone") without becoming real content.
const ADDRESS_FILLER = new Set(['there', 'team', 'everyone', 'all', 'folks', 'guys', 'friend', 'friends']);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Classifies a message as "greeting-only" — a #nohello opener with no actual ask —
 * by scrubbing known greeting/small-talk phrases and checking what's left.
 */
export function detectGreetingOnly(rawText: string, config: GreetingDetectionConfig): DetectionResult {
  const original = rawText.trim();
  if (!original) {
    return { isGreetingOnly: false, matchedPhrases: [] };
  }

  const totalWords = original.split(/\s+/).filter(Boolean);
  const maxGreetingWords = config.maxGreetingWords;
  const maxLeftoverWords = config.maxLeftoverWords;

  const phrases = [
    ...(config.extraGreetingPhrases ?? []),
    ...GREETING_PHRASES,
    ...(config.extraSmalltalkPhrases ?? []),
    ...SMALLTALK_PHRASES,
  ].sort((a, b) => b.length - a.length); // longest first so "hi there" matches before "hi"

  let scrubbed = ` ${normalize(original).replace(/[!?.,;:]/g, ' ')} `;
  const matched: string[] = [];
  for (const phrase of phrases) {
    const re = new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}\\b`, 'gi');
    if (re.test(scrubbed)) {
      matched.push(phrase);
      scrubbed = scrubbed.replace(re, ' ');
    }
  }

  if (matched.length === 0) {
    return { isGreetingOnly: false, matchedPhrases: [] };
  }
  if (totalWords.length > maxGreetingWords) {
    return { isGreetingOnly: false, matchedPhrases: matched };
  }

  const leftover = scrubbed
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !ADDRESS_FILLER.has(word));

  if (leftover.length > maxLeftoverWords) {
    return { isGreetingOnly: false, matchedPhrases: matched };
  }

  return {
    isGreetingOnly: true,
    name: leftover.length > 0 ? toTitleCase(leftover.join(' ')) : undefined,
    matchedPhrases: matched,
  };
}
