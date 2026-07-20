import { describe, expect, it } from 'vitest';
import { detectGreetingOnly } from '../src/detector.js';

const config = { maxGreetingWords: 8, maxLeftoverWords: 2 };

describe('detectGreetingOnly', () => {
  it('flags a bare "hi"', () => {
    expect(detectGreetingOnly('hi', config).isGreetingOnly).toBe(true);
  });

  it('flags a bare "hello"', () => {
    expect(detectGreetingOnly('Hello', config).isGreetingOnly).toBe(true);
  });

  it('flags "Hello <name>" and extracts the name', () => {
    const result = detectGreetingOnly('Hello Bala', config);
    expect(result.isGreetingOnly).toBe(true);
    expect(result.name).toBe('Bala');
  });

  it('flags "Hi, how are you"', () => {
    expect(detectGreetingOnly('Hi, how are you?', config).isGreetingOnly).toBe(true);
  });

  it('flags "hey, quick question"', () => {
    expect(detectGreetingOnly('hey, quick question', config).isGreetingOnly).toBe(true);
  });

  it('does not flag a greeting followed by the real question', () => {
    const result = detectGreetingOnly('Hi, can you review PR #123 today?', config);
    expect(result.isGreetingOnly).toBe(false);
  });

  it('does not flag messages with no greeting at all', () => {
    expect(detectGreetingOnly('Is the deploy pipeline down?', config).isGreetingOnly).toBe(false);
  });

  it('does not flag an empty message', () => {
    expect(detectGreetingOnly('   ', config).isGreetingOnly).toBe(false);
  });

  it('respects maxLeftoverWords — too much leftover content is not a greeting', () => {
    const strict = { maxGreetingWords: 8, maxLeftoverWords: 0 };
    expect(detectGreetingOnly('Hello Bala', strict).isGreetingOnly).toBe(false);
  });

  it('honors extraGreetingPhrases', () => {
    const withExtra = { ...config, extraGreetingPhrases: ['ahoy'] };
    expect(detectGreetingOnly('ahoy', withExtra).isGreetingOnly).toBe(true);
  });

  describe('platform tokens', () => {
    it('strips a Slack user mention and still flags a bare greeting to them', () => {
      const result = detectGreetingOnly('Hi <@U01ABC>', config);
      expect(result.isGreetingOnly).toBe(true);
      expect(result.name).toBeUndefined();
    });

    it('strips a Slack user mention with a display name fallback', () => {
      expect(detectGreetingOnly('Hi <@U01ABC|bala>', config).isGreetingOnly).toBe(true);
    });

    it('strips Slack special mentions like <!here>', () => {
      expect(detectGreetingOnly('Hi <!here>', config).isGreetingOnly).toBe(true);
    });

    it('strips a Slack channel reference the same way as a user mention', () => {
      const result = detectGreetingOnly('Hi <#C01ABC|general>', config);
      expect(result.isGreetingOnly).toBe(true);
    });

    it('does not flag a channel reference followed by a real question', () => {
      const result = detectGreetingOnly('Hi <#C01ABC|general>, can someone help with the migration?', config);
      expect(result.isGreetingOnly).toBe(false);
    });

    it('strips Teams <at> mention tags but keeps the name, same as a plain "Hi Bala"', () => {
      const result = detectGreetingOnly('Hi <at>Bala</at>', config);
      expect(result.isGreetingOnly).toBe(true);
      expect(result.name).toBe('Bala');
    });

    it('does not flag a mention followed by a real question', () => {
      const result = detectGreetingOnly('Hi <@U01ABC>, can you review PR #123 today?', config);
      expect(result.isGreetingOnly).toBe(false);
    });

    it('applies a custom preprocessText hook before built-in token stripping', () => {
      const withHook = { ...config, preprocessText: (text: string) => text.replace(/https?:\/\/\S+/g, '') };
      expect(detectGreetingOnly('Hi https://example.com/doc', withHook).isGreetingOnly).toBe(true);
      expect(detectGreetingOnly('Hi https://example.com/doc', config).isGreetingOnly).toBe(false);
    });
  });
});
