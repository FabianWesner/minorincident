import { afterEach, describe, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

/** PO 10-12: "Evac bus is driing through a truck". The live scripted ride must never put a convoy hull inside another vehicle. */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

describe('L4 convoy ride collisions', () => {
  test('T-E22-04c @E22 @E22-AC04 during the live ride no convoy vehicle overlaps another vehicle entity (convoy, real cars, traffic)', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, s = l.mission.state.l4!, bad: string[] = []; // seed 1: the PO saw a dog under the bus (10-13)
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

  test('T-E22-04f @E22 PO 10-12 "move this soldier away, all busses drive through him": during the live ride no actor stands inside a convoy vehicle hull', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, s = l.mission.state.l4!, bad: string[] = []; // seed 1: the PO saw a dog under the bus (10-13)
    const dims = (e: { archetype?: string }) => e.archetype === 'veh.evac-bus' ? [9.36, 2.7] : e.archetype === 'veh.military-truck' ? [6.93, 2.86] : e.archetype === 'veh.military-apc' ? [5.69, 3.1] : [4.5, 1.9];
    const inside = (v: { transform: { x: number; z: number; yaw: number }; archetype?: string }, a: { x: number; z: number }) => {
      const [len, wid] = dims(v), dx = a.x - v.transform.x, dz = a.z - v.transform.z, c = Math.cos(v.transform.yaw), si = Math.sin(v.transform.yaw);
      return Math.abs(dx * c + dz * si) < len / 2 && Math.abs(-dx * si + dz * c) < wid / 2;
    };
    const check = () => {
      for (const id of s.convoyIds) {
        const v = w.entities.get(id)!;
        for (const e of w.entities.iterate()) {
          if (e.id === id || e.hidden || String(e.archetype).startsWith('veh.') || e.corpse || String(e.archetype).startsWith('pickup.') || e.id === 1 && s.seated) continue;
          if (e.health.current > 0 && inside(v, e.transform)) bad.push(`${e.archetype}#${e.id} in ${v.archetype}#${id} near ${Math.round(e.transform.x)},${Math.round(e.transform.z)}`);
        }
      }
    };
    let t = 0; while (s.phase === 'convoy' && t < 60 * 60) { w.update(); if (t++ % 6 === 0) check(); }
    expect([...new Set(bad)].slice(0, 40)).toEqual([]);
  }, 600_000);

  test('T-E22-04e @E22 PO 10-12 "sound when the bus is driving": every convoy vehicle emits engine events following speed, the courier bus is the muffled one, engines stop after the idle', async () => {
    const l = await loadL4(3); world = l.world; const w = l.world, s = l.mission.state.l4!;
    const seen: { id: number; phase: string; rpm: number; speed: number; inCar?: boolean }[] = [];
    w.events.on('vehicle.sound', e => { if (e.type === 'vehicle.sound') seen.push({ id: e.sourceId, phase: e.phase, rpm: e.rpm, speed: e.speed, inCar: e.inCar }); });
    let t = 0; while (s.phase === 'convoy' && t++ < 60 * 90) w.update();
    for (let i = 0; i < 60 * 8; i++) w.update();
    const engine = seen.filter(e => e.phase === 'engine'), player = s.convoyIds[s.convoyIds.length - 1];
    expect(new Set(engine.map(e => e.id))).toEqual(new Set(s.convoyIds));
    expect(new Set(engine.filter(e => e.inCar).map(e => e.id))).toEqual(new Set([player]));
    const mine = engine.filter(e => e.id === player);
    expect(Math.max(...mine.map(e => e.rpm))).toBeGreaterThan(Math.min(...mine.map(e => e.rpm)) + 2500); // idle -> cruise
    expect(seen.filter(e => e.phase === 'stop').map(e => e.id).sort()).toEqual([...s.convoyIds].sort());
  }, 600_000);

  test('T-E22-04d @E22 PO 10-12 "Bus is extremely vibrating": the player bus pose has no high-frequency jitter over the whole ride', async () => {
    const l = await loadL4(3); world = l.world; const w = l.world, s = l.mission.state.l4!, bus = w.entities.get(s.convoyIds[s.convoyIds.length - 1])!;
    const xs: number[] = [], zs: number[] = [], yaws: number[] = [];
    let t = 0; while (s.phase === 'convoy' && t++ < 60 * 90) { w.update(); xs.push(bus.transform.x); zs.push(bus.transform.z); yaws.push(bus.transform.yaw); }
    expect(xs.length).toBeGreaterThan(60 * 15);
    // High-frequency content: the position residual against a +-6 tick centred moving average, the tick-to-tick change of speed
    // (the last tick of the stop is a tiny remainder step and excluded) and of the yaw rate (a corner starts as a steering ramp).
    const resid = (a: number[]) => { let m = 0; for (let i = 6; i < a.length - 6; i++) { let sum = 0; for (let k = -6; k <= 6; k++) sum += a[i + k] - a[i]; m = Math.max(m, Math.abs(sum / 13)); } return m; };
    const speeds = xs.map((x, i) => i ? Math.hypot(x - xs[i - 1], zs[i] - zs[i - 1]) * 60 : 0), n = speeds.length - 4;
    let dv = 0; for (let i = 2; i < n; i++) dv = Math.max(dv, Math.abs(speeds[i] - speeds[i - 1]));
    const rates = yaws.map((y, i) => i ? Math.atan2(Math.sin(y - yaws[i - 1]), Math.cos(y - yaws[i - 1])) : 0);
    let dr = 0; for (let i = 2; i < n; i++) dr = Math.max(dr, Math.abs(rates[i] - rates[i - 1]));
    console.log('bus jitter', { xz: Math.max(resid(xs), resid(zs)), dv, dr });
    expect(Math.max(resid(xs), resid(zs))).toBeLessThan(.05);
    expect(dv, 'speed change per tick (m/s)').toBeLessThan(.2);
    expect(dr, 'yaw-rate change per tick (rad/tick)').toBeLessThan(.01);
  }, 600_000);
});
