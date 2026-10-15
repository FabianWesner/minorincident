import { describe, expect, it } from 'vitest';
import { l4 } from '../../../src/data/l4';

describe('L4 convoy music mix', () => {
  it('keeps the bus radio at the adaptive score reference level', () => {
    // Streamed score uses 0.5 gain; the radio sits above it while the score is trimmed to 0.3.
    expect(l4.radio.gain).toBe(0.6);
  });
});
