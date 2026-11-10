import { describe, expect, it } from 'vitest';
import { bossChip, bossChipFadeTicks, bossChipHoldTicks, bossChipMinPx } from '../../src/render/HealthBars';
import { bossHitFlashChip, bossHitFlashExposed, bossHitFlashSeconds } from '../../src/render/vfx/Vfx';
import { bossHitFlashTicks, hitFlashTicks } from '../../src/render/CrowdView';

describe('L8 boss hit reaction (r26-l8hitreact, render only)', () => {
  it('keeps a visible bar chip for even a tiny chip hit', () => {
    expect(bossChip(1, 0.95, 0, 64)).toBeGreaterThanOrEqual(bossChipMinPx);
    expect(bossChip(1, 0.7, 0, 64)).toBeCloseTo(0.3 * 64);
  });
  it('holds, fades and disappears', () => {
    expect(bossChip(1, 0.9, bossChipHoldTicks, 64)).toBeGreaterThan(0);
    expect(bossChip(1, 0.9, bossChipHoldTicks + bossChipFadeTicks - 1, 64)).toBeLessThan(bossChip(1, 0.9, bossChipHoldTicks, 64));
    expect(bossChip(1, 0.9, bossChipHoldTicks + bossChipFadeTicks, 64)).toBe(0);
    expect(bossChip(0.5, 0.5, 0, 64)).toBe(0);
  });
  it('never draws past the bar end', () => {
    expect(bossChip(1, 0.02, 0, 64)).toBeLessThanOrEqual(0.98 * 64);
  });
  it('boss flash is marked above 1 and outlasts the ordinary pulse; exposed reads brighter', () => {
    expect(1 + bossHitFlashChip).toBeGreaterThan(1);
    expect(1 + bossHitFlashExposed).toBeLessThan(2);
    expect(bossHitFlashExposed).toBeGreaterThan(bossHitFlashChip);
    expect(bossHitFlashSeconds).toBeGreaterThan(0.1);
    expect(bossHitFlashTicks).toBeGreaterThan(hitFlashTicks);
  });
});
