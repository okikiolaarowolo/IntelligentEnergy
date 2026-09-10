import { describe, expect, it } from 'vitest';
import { createRawApiKey, hashApiKey } from './platform-api';

describe('platform API key utilities', () => {
  it('creates correctly prefixed high-entropy keys', () => {
    const key = createRawApiKey();
    expect(key.startsWith('ie_live_')).toBe(true);
    expect(key.length).toBeGreaterThan(50);
  });

  it('hashes the same key deterministically without returning the secret', () => {
    const key = createRawApiKey();
    const first = hashApiKey(key);
    expect(first).toBe(hashApiKey(key));
    expect(first).not.toBe(key);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
