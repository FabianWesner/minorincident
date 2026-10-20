import { afterEach, expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import type { SimWorld } from '../../src/sim/world/SimWorld';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

/** A closed navigation pocket models a follower left behind rubble after corridor retry. */
function trapFollower(w: SimWorld, id: number) {
  const e = w.entities.get(id)!;
  expect(w.solids.relocate(e, { x: -35, z: 47, y: .7 }, 'test.l7.straggler', 0)).toBe(true);
  for (const [i, [dx, dz, halfX, halfZ]] of [[-1.8, 0, .25, 2], [1.8, 0, .25, 2], [0, -1.8, 2, .25], [0, 1.8, 2, .25]].entries()) {
    const wall = { x: -35 + dx, y: 1.5, z: 47 + dz, halfX, halfY: 1.5, halfZ };
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
  trapFollower(w, last); m.checkpoint('corridor');
  // Exercise production seam serialization, including a timer captured midway through the wait.
  for (let i = 0; i < 600; i++) w.update();
  expect(d.state.phase).toBe('boarding'); expect(d.state.boarded).not.toContain(last);
  const saved = JSON.parse(JSON.stringify(m.saveResume())); m.loadResume(saved);
  let completed: number[] | undefined;
  w.events.on('level.completed', e => { if (e.type === 'level.completed' && e.id === 'L7') completed = e.result.escapedSurvivors!.map(e => e.id); });
  let ticks = 600;
  for (; ticks < 3600 && !completed; ticks++) w.update();
  expect(d.state.phase).toBe('done');
  expect([...completed!].sort((a, b) => a - b)).toEqual(ids);
  expect(c.state.roster.every(r => r.status === 'following')).toBe(true);
  expect(w.events.events().filter(e => e.type === 'mission.signal' && e.name === 'l7.survivor-recovered').map(e => e.type === 'mission.signal' && e.actorId)).toContain(last);
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  console.log(JSON.stringify({ tier, ticks, seconds: ticks / 60, boarded: d.state.boarded.length }));
}, 120_000);
