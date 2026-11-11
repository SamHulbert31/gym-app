import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64 } from './base64';

describe('base64', () => {
  it('round trips plain and non-Latin text', () => {
    for (const s of ['', 'hello', 'Überload — 100 kg × 5 ✓', '日本語', '🏋️‍♂️ 💪', 'a'.repeat(100000)]) {
      expect(decodeBase64(encodeBase64(s))).toBe(s);
    }
  });

  it('matches the standard encoding', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=');
    expect(encodeBase64('✓')).toBe('4pyT');
  });

  it('accepts the newline-wrapped form GitHub sends', () => {
    expect(decodeBase64('aGVs\nbG8=\n')).toBe('hello');
  });
});
