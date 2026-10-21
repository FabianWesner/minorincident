import { Matrix4 } from 'three';
import { View } from '../../src/render/View';
import { afterEach, expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import type { SimWorld } from '../../src/sim/world/SimWorld';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

/** A closed navigation pocket models a follower left behind rubble after corridor retry. */
function trapFollower(w: SimWorld, id: number, x = -35, z = 47) {
  const e = w.entities.get(id)!;
  expect(w.solids.relocate(e, { x, z, y: .7 }, 'test.l7.straggler', 3)).toBe(true);
  x = e.transform.x; z = e.transform.z;
  for (const [i, [dx, dz, halfX, halfZ]] of [[-1.8, 0, .25, 2], [1.8, 0, .25, 2], [0, -1.8, 2, .25], [0, 1.8, 2, .25]].entries()) {
    const wall = { x: x + dx, y: 1.5, z: z + dz, halfX, halfY: 1.5, halfZ };
    w.physics.addBlocker(wall);
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 980_000 + i, blocked: true, wall });
  }
}

for (const tier of ['high', 'low'] as const) test(`@E29-AC13 @E29-AC16 corridor checkpoint with a trapped living follower finishes with the exact roster, ${tier}`, async () => {
  const w = world = await loadLevel('L7', 1), m = w.missions!, d = w.l7Departure!, c = w.l7Encounters!;
  w.npcs!.setQuality(tier); w.combat!.damage.god = true; c.state.started = true;
  m.completeObjective('rocket'); m.completeObjective('corridor');
  const ids = c.state.roster.map(r => r.id), last = ids.at(-1)!;
  ids.forEach((id, i) => {
    const e = w.entities.get(id)!;
    expect(w.solids.relocate(e, { x: -64 + Math.floor(i / 5), z: 45.5 + i % 5, y: .7 }, 'test.l7.queue', 1)).toBe(true);
  });
  expect(w.solids.relocate(w.entities.get(1)!, { x: -70.5, z: 47.5, y: .7 }, 'test.l7.player', 0)).toBe(true);
  trapFollower(w, last, -30, 47); m.checkpoint('corridor');
  // Exercise production seam serialization, including a timer captured midway through the wait.
  for (let i = 0; i < 600; i++) w.update();
  expect(d.state.phase).toBe('boarding'); expect(d.state.boarded).not.toContain(last);
  const saved = JSON.parse(JSON.stringify(m.saveResume())); m.loadResume(saved);
  const recoveredSources: { id: number; offscreen: boolean; distance: number }[] = [];
  const relocate = w.solids.relocate.bind(w.solids);
  w.solids.relocate = (...args) => {
    if (args[2] === 'l7.boarding-recovery') {
      const p = w.entities.get(1)!.transform, e = args[0];
      recoveredSources.push({ id: e.id, offscreen: w.infected!.director.offscreen(e.transform, e.transform.y - .7), distance: Math.hypot(e.transform.x - p.x, e.transform.z - p.z) });
    }
    return relocate(...args);
  };
  let completed: number[] | undefined;
  w.events.on('level.completed', e => { if (e.type === 'level.completed' && e.id === 'L7') completed = e.result.escapedSurvivors!.map(e => e.id); });
  let ticks = 600;
  for (; ticks < 3600 && !completed; ticks++) w.update();
  expect(d.state.phase).toBe('done');
  expect(recoveredSources.some(e => e.id === last)).toBe(true);
  expect(recoveredSources.every(e => e.offscreen && e.distance > 12)).toBe(true);
  expect([...completed!].sort((a, b) => a - b)).toEqual(ids);
  expect(c.state.roster.every(r => r.status === 'following')).toBe(true);
  expect(w.events.events().filter(e => e.type === 'mission.signal' && e.name === 'l7.survivor-recovered').map(e => e.type === 'mission.signal' && e.actorId)).toContain(last);
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  console.log(JSON.stringify({ tier, ticks, seconds: ticks / 60, boarded: d.state.boarded.length }));
}, 120_000);

for (const trap of [{ name: 'nearby', x: -62, z: 45.8 }, { name: 'visible beyond 12 m', x: -84, z: 47 }])
for (const tier of ['high', 'low'] as const) test(`@E29-AC13 @E29-AC16 ${trap.name} trapped follower walks aboard without a relocation or pop, ${tier}`, async () => {
  const w = world = await loadLevel('L7', 1), m = w.missions!, d = w.l7Departure!, c = w.l7Encounters!;
  w.npcs!.setQuality(tier); w.combat!.damage.god = true; c.state.started = true;
  m.completeObjective('rocket'); m.completeObjective('corridor');
  const ids = c.state.roster.map(r => r.id), last = ids.at(-1)!;
  let follower = w.entities.get(last)!;
  for (const id of ids.slice(0, -1)) {
    const e = w.entities.get(id)!; e.hidden = true; e.passengerOf = d.state.busId; d.state.boarded.push(id);
  }
  const player = w.entities.get(1)!;
  expect(w.solids.relocate(player, { x: -70.5, z: 47.5, y: .7 }, 'test.l7.player', 0)).toBe(true);
  trapFollower(w, last, trap.x, trap.z);
  if (trap.name === 'visible beyond 12 m') expect(Math.hypot(follower.transform.x - player.transform.x, follower.transform.z - player.transform.z)).toBeGreaterThan(12);
  const view = new View(); view.resize(1600, 900); view.zoom(Math.log(1.5), true); view.reset(player.transform, true);
  w.infected!.director.setFrustum(new Matrix4().multiplyMatrices(view.simCamera.projectionMatrix, view.simCamera.matrixWorldInverse).elements, view.simCamera.position);
  expect(w.infected!.director.offscreen(follower.transform)).toBe(false);
  const recoveries: { id: number; offscreen: boolean; distance: number }[] = [];
  w.events.on('mission.signal', e => {
    if (e.type === 'mission.signal' && e.name === 'l7.survivor-recovered') {
      const actor = w.entities.get(e.actorId!)!;
      recoveries.push({ id: actor.id, offscreen: w.infected!.director.offscreen(actor.transform), distance: Math.hypot(actor.transform.x - player.transform.x, actor.transform.z - player.transform.z) });
    }
  });
  let assisted = false, restored = false;
  for (let tick = 0; tick < 3600 && d.state.phase !== 'departing'; tick++) {
    const before = { ...follower.transform }, wasHidden = !!follower.hidden;
    w.update();
    // The entire approach stays continuous. Hiding is allowed only at the actual bus door.
    expect(Math.hypot(follower.transform.x - before.x, follower.transform.z - before.z)).toBeLessThan(.25);
    if (!wasHidden && follower.hidden) expect(Math.hypot(follower.transform.x + 74.4, follower.transform.z - 47)).toBeLessThan(.1);
    if (d.state.assisting?.includes(last)) {
      assisted = true; expect(follower.hidden).toBeFalsy();
      if (!restored) { const saved = JSON.parse(JSON.stringify(m.saveResume())); m.loadResume(saved); follower = w.entities.get(last)!; restored = true; }
    }
  }
  expect(assisted).toBe(true); expect(restored).toBe(true);
  expect(recoveries).toEqual([]);
  expect(d.state.boarded).toContain(last); expect(d.state.phase).toBe('departing');
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
}, 120_000);
