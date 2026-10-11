import { describe, expect, it } from 'vitest';
import { footprintCoverage, rasterFootprints, TRACK_SIZE, TRACK_LIFETIME } from '../../../src/render/FootprintMask';

describe('weather footprints', () => {
  it('has a rounded heel, wider forefoot and mirrored arch instead of a cross', () => {
    expect(footprintCoverage(-.09, 0, .28, false, 1)).toBeGreaterThan(.5);
    expect(footprintCoverage(.06, .055, .28, false, 1)).toBeGreaterThan(.2);
    expect(footprintCoverage(-.02, .055, .28, false, 1)).toBe(0);
    expect(footprintCoverage(.06, .04, .28, false, 1)).toEqual(footprintCoverage(.06, -.04, .28, false, -1));
    expect(footprintCoverage(0, .14, .28, false, 1)).toBe(0);
  });
  it('has four distinct toe pads ahead of an animal heel pad', () => {
    for (const [x, z] of [[.18, -.3], [.34, -.11], [.34, .11], [.18, .3], [-.16, 0]])
      expect(footprintCoverage(x * .12, z * .12, .12, true, 1)).toBeGreaterThan(.9);
    expect(footprintCoverage(.05, .05, .12, true, 1)).toBe(0);
  });
  it('bounds the window, keeps ground and bridge layers separate, and expires prints', () => {
    const data = new Uint8Array(TRACK_SIZE * TRACK_SIZE * 4);
    const track = { id: 1, x: 0, y: 0, z: 0, yaw: 0, tick: 0, length: .28, paw: false, side: 1 };
    const pixels = rasterFootprints(data, [track, { ...track, y: 6 }], 0, 0, 0);
    expect(pixels).toBeGreaterThan(0);
    expect(data.some((v, i) => i % 4 === 3 && v > 80)).toBe(true);
    expect(rasterFootprints(data, [{ ...track, x: 64 }], 0, 0, 0)).toBe(0);
    expect(rasterFootprints(data, [track], TRACK_LIFETIME, 0, 0)).toBe(0);
  });
});
