import { createHash } from 'node:crypto';
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
  it('T-E29-19-tracks @E29-AC19 low resolution retains both height layers and lifetime', () => {
    const data = new Uint8Array((TRACK_SIZE / 4) ** 2 * 4);
    const track = { id: 1, x: 2, y: 0, z: -1, yaw: .7, tick: 0, length: .28, paw: false, side: -1 };
    expect(rasterFootprints(data, [track, { ...track, y: 3.9 }], 0, 0, 0)).toBeGreaterThan(0);
    expect(data.some((v, i) => i % 4 === 0 && v > 0)).toBe(true);
    expect(data.some((v, i) => i % 4 === 2 && v > 0)).toBe(true);
    expect(rasterFootprints(data, [track], TRACK_LIFETIME, 0, 0)).toBe(0);
  });

  it('T-E29-19-track-raster @E29-AC19 cached crowd probes preserve the shipped mask bytes', () => {
    const tracks = Array.from({ length: 200 }, (_, i) => ({ id: i, x: Math.sin(i) * 7.8, y: i % 3 ? 0 : 3.9, z: Math.cos(i * 3) * 7.8, yaw: i * .71, tick: i, length: i % 2 ? .28 : .12, paw: !!(i % 2), side: i % 2 ? 1 : -1 }));
    // Digests captured from the original four-probe rasterizer at both shipped resolutions.
    for (const [size, pixels, digest] of [[256, 1773, '1162a134f7f734e3f822c5fa0a9c1ca0c12c8f8a19ac2745b545dbb8a13c640e'], [1024, 20537, '6298227fa42e0eb08cf15e2ae12da497ae8115c208f2387ae87a3b7b9a3703f2']] as const) {
      const data = new Uint8Array(size * size * 4);
      expect(rasterFootprints(data, tracks, 900, 0, 0)).toBe(pixels);
      expect(createHash('sha256').update(data).digest('hex')).toBe(digest);
      rasterFootprints(data, tracks, 900, 0, 0); // Reuse the coverage rather than recomputing four probes.
      expect(createHash('sha256').update(data).digest('hex')).toBe(digest);
    }
    const low = new Uint8Array(256 ** 2 * 4);
    for (const [tick, x, z, digest] of [[1000, 0, 0, '2d54a8b041844c5c149d14c26fce90f13f9e8c1cab8f74c481bc24c0fab857f6'], [1000, 4, -4, '3723275ae6bf690e28acd5866e7b6857824fac35ae1b2afaa6cb8cb8275e2943'], [1100, 0, 0, '2a80d8af069cdb6c86f2f016c869de073c4135f135b3733e51b6e2f4d4226f68']] as const) {
      rasterFootprints(low, tracks, tick, x, z);
      expect(createHash('sha256').update(low).digest('hex')).toBe(digest);
    }
  });

});
