import { expect, test } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import { LabAccidentFx, type LabAccidentHost } from '../../../src/render/vfx/labAccident';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

function rig(flashReduction = false) {
  const events = new EventBus<{ tick: number; type: string; anchor?: string }>(), spawns: { color: number; time: number; life: number }[] = [], shakes: number[] = [], lights: number[] = [], glass: string[] = [];
  const host: LabAccidentHost = { time: 0, particles: { budget: 2048, spawn: (now: number, life: number, _x: number, _y: number, _z: number, _a: number, _b: number, _c: number, _s: number, _sh: number, color: number) => { spawns.push({ color, time: now, life }); return 0; } } as unknown as LabAccidentHost["particles"] };
  const fx = new LabAccidentFx({ seed: 5, events, entities: { get: () => ({ transform: { x: 60, z: -8 } }), iterate: () => [] } } as unknown as SimWorld, host, { shake: s => shakes.push(s), windowLight: l => lights.push(l), windowGlass: s => glass.push(s) },
    name => ({ 'lab-exit-window': { x: 60, z: -20 }, 'lab-smoke-vent': { x: 62, z: -22 }, 'lab-smoke-window': { x: 60, z: -20 }, 'lab-exit-front': { x: 58, z: -12 } } as Record<string, { x: number; z: number }>)[name]);
  fx.flashReduction = flashReduction;
  const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) { host.time += 1 / 60; fx.advance(1 / 60); } };
  return { events, fx, host, spawns, shakes, lights, glass, run };
}

test('T-E19-19b @E19 @E19-AC19 accident FX: flicker, contained blast with short shake, glass, faint-green smoke, infection puff', () => {
  const r = rig();
  r.events.emit({ type: 'l1.flicker', tick: 0 });
  r.run(1.5);
  expect(Math.min(...r.lights)).toBeLessThan(0.5);
  expect(r.spawns).toHaveLength(0);
  r.events.emit({ type: 'l1.blast', tick: 90, anchor: 'lab-exit-window' });
  const burst = r.spawns.length;
  expect(burst).toBeGreaterThan(20);
  expect(burst).toBeLessThan(100); // contained, not a fireball
  r.run(0.3);
  expect(r.glass).toContain('shatter');
  expect(Math.max(...r.shakes)).toBeGreaterThan(0.05);
  r.run(1.5);
  const shakeCount = r.shakes.length;
  r.run(0.5);
  expect(r.shakes.length).toBe(shakeCount); // shake ended within ~1.5 s
  r.events.emit({ type: 'l1.smoke', tick: 200 });
  r.run(2);
  const smoke = r.spawns.filter(s => s.color === 0x7d8f80);
  expect(smoke.length).toBeGreaterThan(20);
  const g = (0x7d8f80 >> 8) & 255, red = 0x7d8f80 >> 16, b = 0x7d8f80 & 255;
  expect(g).toBeGreaterThan(red); expect(g).toBeGreaterThan(b); // faint green tint
  expect(r.fx.flash).toBeGreaterThanOrEqual(0);
  r.run(60); // the smoke column is a persistent landmark
  const late = r.spawns.length; r.run(2);
  expect(r.spawns.length).toBeGreaterThan(late);
  r.events.emit({ type: 'l1.infectedExit', tick: 300, anchor: 'lab-exit-front' });
  expect(r.spawns.filter(s => s.color === 0x96b76a).length).toBeGreaterThan(5);
  expect(r.fx.state.smoking).toBe(true);
  r.fx.dispose();
});

test('T-E19-19c @E19 @E19-AC19 reduced flashing never strobes and prewarm leaves nothing alive', () => {
  const r = rig(true);
  r.events.emit({ type: 'l1.flicker', tick: 0 });
  r.run(1.5);
  expect(Math.min(...r.lights)).toBeGreaterThanOrEqual(0.6);
  r.events.emit({ type: 'l1.blast', tick: 90 });
  r.run(0.5);
  expect(Math.max(...r.shakes)).toBeLessThanOrEqual(0.05);
  const w = rig(); w.fx.prewarm();
  expect(w.spawns.length).toBeGreaterThan(40);
  expect(w.spawns.every(s => s.life <= 0.01)).toBe(true);
});
