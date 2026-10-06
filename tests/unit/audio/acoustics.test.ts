import { test, expect } from 'vitest';
import { contains, occlusions, surfaceAt, dopplerRate, type AcousticMap } from '../../../src/audio/acoustics';
test('T-E16-07b @E16 @E16-AC07 segment occlusion counts buildings, capped at two', () => {
    const map: AcousticMap = { surfaces: [], zones: [], buildings: [1, 3, 5].map(x => ({ min: { x, z: -1 }, max: { x: x + 1, z: 1 } })) };
    expect(occlusions(map, { x: 0, z: 0 }, { x: 7, z: 0 })).toBe(2);
    expect(occlusions(map, { x: 0, z: 2 }, { x: 7, z: 2 })).toBe(0);
    expect(occlusions(map, { x: 0, z: 0 }, { x: 2.5, z: 0 })).toBe(1);
});
test('T-E16-09b @E16 @E16-AC09 authored polygons select surfaces with asphalt fallback', () => {
    const polygon: [
        [
            number,
            number
        ],
        [
            number,
            number
        ],
        [
            number,
            number
        ],
        [
            number,
            number
        ]
    ] = [[1, 1], [3, 1], [3, 3], [1, 3]];
    expect(contains({ x: 2, z: 2 }, polygon)).toBe(true);
    expect(contains({ x: 0, z: 2 }, polygon)).toBe(false);
    expect(surfaceAt({ surfaces: [{ surface: 'wood', polygon }], zones: [], buildings: [] }, { x: 2, z: 2 })).toBe('wood');
    expect(surfaceAt({ surfaces: [], zones: [], buildings: [] }, { x: 2, z: 2 })).toBe('asphalt');
});
test('T-E16-08b @E16 @E16-AC08 radial Doppler ignores lateral velocity and includes listener velocity', () => {
    expect(dopplerRate({ x: 0, z: -5 }, { x: 15, z: 0 }, { x: 0, z: 0 })).toBe(1);
    expect(dopplerRate({ x: 0, z: -5 }, { x: 0, z: 15 }, { x: 0, z: 0 })).toBeGreaterThan(1);
    expect(dopplerRate({ x: 0, z: -5 }, { x: 0, z: -15 }, { x: 0, z: 0 })).toBeLessThan(1);
    expect(dopplerRate({ x: 0, z: -5 }, { x: 0, z: 15 }, { x: 0, z: 0 }, { x: 0, z: 15 })).toBe(1);
});
