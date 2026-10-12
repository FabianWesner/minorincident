import { describe, expect, it } from 'vitest';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';

const anchors: Record<string, { x: number; z: number; radius?: number }> = { 'l3-zone': { x: 149, z: 0, radius: .9 }, 'l3-route': { x: -120, z: 0 }, 'l1-depot': { x: 5, z: 6 } };
const mission = (marker: string | null, l3 = true) => ({ def: { l3, anchors }, state: { marker } }) as unknown as Parameters<typeof markerAnchor>[0];

describe('objective marker world position (PO 10-12)', () => {
  it('L3 route guidance never moves the marker: it stays on the fixed rendezvous ring over time', () => {
    const m = mission('l3-route');
    const positions = new Set<string>();
    for (let tick = 0; tick < 600; tick++) {
      // The guidance waypoint follows the player along the route every tick.
      Object.assign(anchors['l3-route'], { x: -120 + tick * .4, z: Math.sin(tick / 20) * 3 });
      const a = markerAnchor(m)!; positions.add(`${a.x},${a.z}`);
    }
    expect([...positions]).toEqual(['149,0']);
  });
  it('fixed anchors are returned unchanged, no marker gives null', () => {
    expect(markerAnchor(mission('l1-depot', false))).toEqual({ x: 5, z: 6 });
    expect(markerAnchor(mission(null))).toBeNull();
    expect(markerAnchor(null)).toBeNull();
  });
});
