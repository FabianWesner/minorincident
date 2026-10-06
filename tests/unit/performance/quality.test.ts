import { describe, expect, it } from 'vitest';
import { Quality, qualityBudgets, startingTier } from '../../../src/core/Quality';
const desktop = { userAgent: 'Chrome Mac', touchPoints: 0, coarsePointer: false };
function frames(q: Quality, seconds: number, cost: number, cinematic = false) { for (let i = 0; i < seconds * 60; i++) q.observe(cost, 1 / 60, cinematic); }
describe('E18 quality policy', () => {
  it('T-E18-04 @E18-AC04 adapts within 6 seconds and recovers only at next level start', () => {
    const q = new Quality('auto', desktop), changes: string[] = []; q.onChange(t => changes.push(t));
    frames(q, 4, 30); expect(q.tier).toBe('high'); frames(q, 2, 30); expect(q.tier).toBe('low');
    frames(q, 20, 10); expect(q.tier).toBe('low'); q.startLevel(); expect(q.tier).toBe('high'); expect(changes).toEqual(['low', 'high']);
  });
  it('T-E18-04b @E18-AC04 defers degradation through a cinematic, ignores spikes and honors explicit settings', () => {
    const q = new Quality('auto', desktop); frames(q, 6, 30, true); expect(q.tier).toBe('high'); frames(q, 1, 30); expect(q.tier).toBe('low');
    q.set('high'); frames(q, 20, 100); expect(q.tier).toBe('high'); q.set('auto');
    frames(q, 3, 30); frames(q, 2, 10); frames(q, 3, 30); expect(q.tier).toBe('high');
    for (let i = 0; i < 600; i++) q.observe(i % 20 === 0 ? 100 : 10, 1 / 60); expect(q.tier).toBe('high');
    expect(() => q.set('invalid' as 'auto')).toThrow();
  });
  it('T-E18-04c @E18-AC04 an exact budget cadence does not degrade due to Float32 rounding', () => {
    const q = new Quality('auto', desktop); frames(q, 6, 16.7); expect(q.tier).toBe('high');
    frames(q, 6, 16.71); expect(q.tier).toBe('low');
  });
  it('T-E18-07 @E18-AC07 selects low for mobile profiles and enforces distinct tier budgets', () => {
    for (const userAgent of ['Pixel 7 Android', 'iPhone 14', 'iPad']) expect(startingTier({ ...desktop, userAgent })).toBe('low');
    expect(startingTier({ ...desktop, touchPoints: 5, coarsePointer: true })).toBe('low');
    expect(startingTier({ ...desktop, memoryGB: 4 })).toBe('low'); expect(startingTier(desktop)).toBe('high');
    expect(qualityBudgets.low.pixelRatio).toBe(1.5); expect(qualityBudgets.high.infected).toBe(200); expect(qualityBudgets.low.infected).toBe(100);
  });
});
