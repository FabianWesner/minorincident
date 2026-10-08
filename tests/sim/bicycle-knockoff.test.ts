import { expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

// PO 10-08 (PROD, verbatim): "I was driving on the bike in L1 and when I was attacked by a zombie the bike just disappeared..."
// Cause: the infected-contact dismount parked the bike on clear *pavement* within 8 m; on a stretch of street without
// one it fell back to the last parking spot (the start rack or the depot), so the bike jumped far out of view.
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function teleport(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x, z, y: w.districts!.pavingHeight(x, z) + .72 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}
async function riding(at: { x: number; z: number }, heading: number, speed: number) {
  const { world: w, mission } = await loadL1(1);
  w.combat!.damage.god = true;
  for (const id of ['pickup', 'deliver', 'escape']) mission.completeObjective(id);
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  w.infected!.director.levelCap = 0;
  const b = w.vehicles!.bicycle, p = w.entities.get(1)!, s = b.entity!.bicycle!, rack = { ...b.entity!.transform };
  s.mounted = true; s.heading = heading; s.speed = speed; p.riding = b.entity!.id;
  teleport(w, at.x, at.z); step(w, 1);
  return { w, mission, b, p, rack };
}
/** Rides along +x into an infected standing in the road; returns the rider position at the bump. */
function rideInto(w: SimWorld, from: { x: number; z: number }, gap: number) {
  w.infected!.director.levelCap = 60;
  w.infected!.spawn('infected.runner', { x: from.x + gap, z: from.z }, { state: 'idle' });
  w.setInput({ move: { x: 1, z: 0 } });
  const b = w.vehicles!.bicycle, p = w.entities.get(1)!;
  for (let i = 0; i < 240 && b.riding; i++) step(w, 1);
  w.setInput({ move: { x: 0, z: 0 } });
  return { x: p.transform.x, z: p.transform.z };
}

test('an infected bump at speed knocks the courier off; the bike tips over beside her, stays, and can be remounted @E19 @E19-AC16', async () => {
  // A street stretch with no clear pavement within 8 m (the old fallback teleported the bike back to the start rack).
  const start = { x: -74, z: 54 };
  const { w, mission, b, p, rack } = await riding(start, 0, 7);
  try {
    const id = b.entity!.id;
    const bump = rideInto(w, start, 6);
    expect(b.riding).toBe(false);
    const bike = b.entity!; expect(bike.id).toBe(id); expect(w.entities.get(id)).toBe(bike);
    const t = bike.transform, d = Math.hypot(t.x - bump.x, t.z - bump.z);
    expect(d, JSON.stringify({ bump, bike: t, rack })).toBeLessThanOrEqual(3.2);
    expect(Math.hypot(t.x - rack.x, t.z - rack.z)).toBeGreaterThan(10);
    expect(t.y).toBeCloseTo(w.districts!.pavingHeight(t.x, t.z), 3);
    expect(bike.bicycle!.fallen).toBeDefined(); expect(Math.abs(bike.bicycle!.fallen!.side)).toBe(1);
    // A short stumble: input is locked briefly, no damage.
    expect(p.combat!.staggerUntil).toBeGreaterThan(w.tick); expect(p.health.current).toBe(p.health.max);
    // It lies where it fell: it never moves while she fights or walks around it.
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    w.infected!.director.levelCap = 0;
    const lying = { ...t }; step(w, 300); expect(b.entity!.transform).toEqual(lying);
    // A checkpoint restore carries the fallen bike exactly.
    mission.checkpoint(mission.def.checkpoints[0]); step(w, 1);
    Object.assign(b.entity!.transform, rack); delete b.entity!.bicycle!.fallen;
    mission.restore();
    expect(b.entity!.transform.x).toBeCloseTo(lying.x, 6); expect(b.entity!.transform.z).toBeCloseTo(lying.z, 6); expect(b.entity!.bicycle!.fallen).toBeDefined();
    // Obstacle for infected/corgi routing (nav blocker at the lying frame) and for the courier's capsule.
    expect(w.infected!.nav.clear(lying.x, lying.z, .1)).toBe(false);
    // Walk up and press E: she picks it up and rides on.
    teleport(w, lying.x, lying.z + 1.1); step(w, 30);
    expect(w.vehicles!.canInteract()).toBe(true);
    w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false });
    expect(b.riding).toBe(true); expect(b.entity!.bicycle!.fallen).toBeUndefined();
    expect(Math.hypot(p.transform.x - lying.x, p.transform.z - lying.z)).toBeLessThan(3.5);
    const from = { ...p.transform }; w.setInput({ move: { x: 1, z: 0 } }); step(w, 90); w.setInput({ move: { x: 0, z: 0 } });
    expect(b.riding, JSON.stringify({ from, at: p.transform, infected: w.infected!.active.length })).toBe(true); expect(Math.hypot(p.transform.x - from.x, p.transform.z - from.z)).toBeGreaterThan(3);
  } finally { w.dispose(); }
}, 60_000);

test('an infected reaching a rider who has stopped also tips the bike over beside her, never elsewhere @E19', async () => {
  const start = { x: -40, z: 0 };
  const { w, b, p } = await riding(start, 0, 0);
  try {
    w.infected!.director.levelCap = 60;
    w.infected!.spawn('infected.runner', { x: start.x + 4, z: start.z }, { state: 'chase' });
    for (let i = 0; i < 600 && b.riding; i++) step(w, 1);
    expect(b.riding).toBe(false);
    const t = b.entity!.transform;
    expect(Math.hypot(t.x - p.transform.x, t.z - p.transform.z)).toBeLessThanOrEqual(3.5);
    expect(b.entity!.bicycle!.fallen).toBeDefined();
  } finally { w.dispose(); }
}, 60_000);

test('riding into a parked car stops the bike with her still on it; the bike stays under her @E19', async () => {
  // veh.suv-dark:71 at (-37.2, -7.45), body x -38.6..-35.9.
  const start = { x: -44, z: -7.45 };
  const { w, b, p } = await riding(start, 0, 7);
  try {
    w.setInput({ move: { x: 1, z: 0 } }); step(w, 120); w.setInput({ move: { x: 0, z: 0 } }); step(w, 10);
    expect(p.transform.x).toBeLessThan(-38.6);
    expect(b.entity).toBeDefined();
    const t = b.entity!.transform;
    if (b.riding) expect(Math.hypot(t.x - p.transform.x, t.z - p.transform.z)).toBeLessThan(.01);
    else expect(Math.hypot(t.x - p.transform.x, t.z - p.transform.z)).toBeLessThanOrEqual(8.5);
  } finally { w.dispose(); }
}, 60_000);
