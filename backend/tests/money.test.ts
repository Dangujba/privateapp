import { describe, expect, it } from 'vitest';
import { koboToNaira, koboToNanoton, nairaToKobo } from '../src/lib/money.js';

describe('revenue money calculations', () => {
  it('converts naira to integer kobo', () => { expect(nairaToKobo('1000.50')).toBe(100050n); });
  it('formats kobo as naira', () => { expect(koboToNaira(100050n)).toBe('1000.50'); });
  it('converts assessed kobo to nanoton using the configured rate', () => { expect(koboToNanoton(100000n, 500000n)).toBe(200000000n); });
});
