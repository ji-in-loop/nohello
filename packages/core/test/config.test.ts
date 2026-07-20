import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, resolveNoHelloConfig, validateNoHelloConfig } from '../src/config.js';

describe('resolveNoHelloConfig', () => {
  it('returns the defaults when given no overrides', () => {
    expect(resolveNoHelloConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('merges partial overrides on top of the defaults', () => {
    const config = resolveNoHelloConfig({ waitSeconds: 45, tone: 'friendly' });
    expect(config).toEqual({ ...DEFAULT_CONFIG, waitSeconds: 45, tone: 'friendly' });
  });
});

describe('validateNoHelloConfig', () => {
  it('accepts the default config', () => {
    expect(() => validateNoHelloConfig(DEFAULT_CONFIG)).not.toThrow();
  });

  it('accepts a valid custom-tone config', () => {
    expect(() =>
      validateNoHelloConfig({ ...DEFAULT_CONFIG, tone: 'custom', customTemplate: 'Hey {name}' }),
    ).not.toThrow();
  });

  it('rejects a tone that is not one of the known values (e.g. a typo\'d env var)', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, tone: 'frendly' as never })).toThrow(/tone must be one of/);
  });

  it('rejects waitSeconds <= 0', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, waitSeconds: 0 })).toThrow(/waitSeconds/);
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, waitSeconds: -5 })).toThrow(/waitSeconds/);
  });

  it('rejects a non-finite waitSeconds', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, waitSeconds: NaN })).toThrow(/waitSeconds/);
  });

  it('rejects a negative cooldownSeconds', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, cooldownSeconds: -1 })).toThrow(/cooldownSeconds/);
  });

  it('accepts a zero cooldownSeconds', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, cooldownSeconds: 0 })).not.toThrow();
  });

  it('rejects maxGreetingWords <= 0', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, maxGreetingWords: 0 })).toThrow(/maxGreetingWords/);
  });

  it('rejects a negative maxLeftoverWords', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, maxLeftoverWords: -1 })).toThrow(/maxLeftoverWords/);
  });

  it('accepts a zero maxLeftoverWords', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, maxLeftoverWords: 0 })).not.toThrow();
  });

  it('rejects tone "custom" without a customTemplate', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, tone: 'custom' })).toThrow(/customTemplate/);
  });

  it('rejects tone "custom" with a blank customTemplate', () => {
    expect(() => validateNoHelloConfig({ ...DEFAULT_CONFIG, tone: 'custom', customTemplate: '   ' })).toThrow(
      /customTemplate/,
    );
  });
});
