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
});
