import { describe, expect, it } from 'vitest';
import { renderResponse } from '../src/responses.js';

describe('renderResponse', () => {
  it('renders a non-empty professional response, with the name included when given', () => {
    const withName = renderResponse('professional', { name: 'Bala', waitSeconds: 90 }, undefined, () => 0);
    const withoutName = renderResponse('professional', { waitSeconds: 90 }, undefined, () => 0);
    expect(withName.length).toBeGreaterThan(0);
    expect(withName).toContain('Bala');
    expect(withoutName.length).toBeGreaterThan(0);
    expect(withoutName).not.toContain('undefined');
  });

  it('renders a non-empty friendly response, with the name included when given', () => {
    const withName = renderResponse('friendly', { name: 'Sam', waitSeconds: 30 }, undefined, () => 0);
    expect(withName).toContain('Sam');
  });

  it('renders a non-empty satirical response, with the name included when given', () => {
    const withName = renderResponse('satirical', { name: 'Priya', waitSeconds: 30 }, undefined, () => 0);
    expect(withName).toContain('Priya');
  });

  it('picks a different template variant based on the injected random function', () => {
    const first = renderResponse('professional', { waitSeconds: 90 }, undefined, () => 0);
    const last = renderResponse('professional', { waitSeconds: 90 }, undefined, () => 0.999);
    expect(first).not.toBe(last);
  });

  it('substitutes {name} and {waitSeconds} in a custom template', () => {
    const text = renderResponse(
      'custom',
      { name: 'Bala', waitSeconds: 45 },
      'Hey {name} — what do you need? (waited {waitSeconds}s)',
    );
    expect(text).toBe('Hey Bala — what do you need? (waited 45s)');
  });

  it('substitutes an empty string for {name} when no name was extracted, without leaving double spaces', () => {
    const text = renderResponse('custom', { waitSeconds: 45 }, 'Hey {name} what do you need?');
    expect(text).toBe('Hey what do you need?');
  });

  it('throws when tone is "custom" but no customTemplate is provided', () => {
    expect(() => renderResponse('custom', { waitSeconds: 45 })).toThrow(/customTemplate/);
  });

  it('throws a clear error for an unrecognized tone instead of a raw TypeError', () => {
    expect(() => renderResponse('bogus' as never, { waitSeconds: 45 })).toThrow(/unknown tone/);
  });
});
