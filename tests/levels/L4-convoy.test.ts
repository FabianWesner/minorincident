import { afterEach, describe, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

/** PO 10-12: "Evac bus is driing through a truck". The live scripted ride must never put a convoy hull inside another vehicle. */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

describe('L4 convoy ride collisions', () => {
  test('T-E22-04c @E22 @E22-AC04 during the live ride no convoy vehicle overlaps another vehicle entity (convoy, real cars, traffic)', async () => {
    const l = await loadL4(3); world = l.world; const w = l.world, s = l.mission.state.l4!, bad: string[] = [];
    const dims = (e: { archetype?: string }) => e.archetype === 'veh.evac-bus' ? [9.36, 2.7] : e.archetype === 'veh.military-truck' ? [6.93, 2.86] : e.archetype === 'veh.military-apc' ? [5.69, 3.1] : [4.5, 1.9];
    const obb = (e: { transform: { x: number; z: number; yaw: number }; archetype?: string }) => { const [len, wid] = dims(e); return { x: e.transform.x, z: e.transform.z, yaw: e.transform.yaw, hl: len / 2 - .05, hw: wid / 2 - .05 }; };
    type O = ReturnType<typeof obb>;
    const axes = (o: O) => [[Math.cos(o.yaw), -Math.sin(o.yaw)], [Math.sin(o.yaw), Math.cos(o.yaw)]];
    const corners = (o: O) => { const [u, v] = axes(o); return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [o.x + u[0] * o.hl * a + v[0] * o.hw * b, o.z + u[1] * o.hl * a + v[1] * o.hw * b]); };
    const overlap = (a: O, b: O) => { const ca = corners(a), cb = corners(b); for (const ax of [...axes(a), ...axes(b)]) { const pa = ca.map(c => c[0] * ax[0] + c[1] * ax[1]), pb = cb.map(c => c[0] * ax[0] + c[1] * ax[1]); if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false; } return true; };
    const ids = new Set(s.convoyIds);
    let seen = 0;
    const check = () => {
      const vehicles = [...w.entities.iterate()].filter(e => String(e.archetype).startsWith('veh.') && !e.hidden);
      seen = Math.max(seen, vehicles.length);
      for (const id of ids) { const a = w.entities.get(id)!; for (const b of vehicles) if (b.id !== id && (!ids.has(b.id) || b.id > id) && overlap(obb(a), obb(b))) bad.push(`${a.archetype}#${id} x ${b.archetype}#${b.id} at ${a.transform.x.toFixed(1)},${a.transform.z.toFixed(1)}`); }
    };
    let t = 0; while (s.phase === 'convoy' && t < 60 * 60) { w.update(); if (t++ % 6 === 0) check(); }
    check();
    expect(seen).toBeGreaterThanOrEqual(5);
    expect([...new Set(bad)].slice(0, 400)).toEqual([]);
  }, 600_000);
});
