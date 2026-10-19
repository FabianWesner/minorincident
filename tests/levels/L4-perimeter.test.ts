import { expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { l4 } from '../../src/data/l4';
import { l4PerimeterWalls, l4PerimeterSegments } from '../../src/data/l4Perimeter';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';

function place(w: SimWorld, at: { x: number; z: number }): void {
  w.clearInput(); w.player!.locomotion.reset();
  const p = w.entities.get(1)!; Object.assign(p.transform, at, { y: .75 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform); w.spatial.set(1, at.x, at.z);
}
/** Production controls and capsule sweep, without replaying the entire battle for every grid tile. */
function walk(w: SimWorld, input: ReturnType<typeof emptyInput>, n: number): void {
  for (let i = 0; i < n; i++) {
    const frame = w.controls.resolve(i ? { ...input, moveTarget: undefined } : input);
    w.player!.prePhysics(frame, w.tick); w.physics.update(); w.player!.postPhysics(w.tick);
  }
}
function plazaGrid(w: SimWorld, phase: string): void {
  const nav = w.infected!.nav.forPlayer(.37, .25), centre = { x: -18.2, z: 4 }, failures: string[] = [], player = w.entities.get(1)!;
  const pose = { ...player.transform }, hidden = player.hidden;
  player.hidden = false; w.physics.playerCollider!.setEnabled(true);
  // This gate is for invisible static blockers; visible, moving people are tested by crowd suites.
  w.player!.locomotion.crowd = [];
  let sampled = 0;
  for (let x = Math.ceil(l4.perimeter.x0 + .6); x <= Math.floor(l4.perimeter.x1 - .6); x++) for (let z = Math.ceil(l4.perimeter.z0 + .6); z <= Math.floor(l4.perimeter.z1 - .6); z++) {
    const target = { x, z };
    if (!nav.clear(x, z, .37)) continue;
    const from = Array.from({length:32},(_,i)=>({x:x+Math.cos(i*Math.PI/16)*.75,z:z+Math.sin(i*Math.PI/16)*.75})).find(p => nav.clampPlayerTarget(p,.35).x === p.x && nav.clampPlayerTarget(p,.35).z === p.z && nav.clear(p.x,p.z,.37) && nav.visible(p,target,.37));
    if (!from) { failures.push(`${phase} no open approach ${x},${z}`); continue; }
    const route = { path: [] as number[], goal: -1, pathIndex: 0 }, point = { x: 0, z: 0 };
    const found = nav.steer(centre, target, route, .37, point, 100000, true);
    const last = route.path.at(-1), end = last === undefined ? point : { x: nav.x(last), z: nav.z(last) };
    if (!found || !nav.visible(end, target, .37)) {
      place(w, centre); walk(w, { ...emptyInput(), moveTarget:target }, 1200);
      const actual=w.entities.get(1)!.transform;
      if (Math.abs(actual.x-x) >= .5 || Math.abs(actual.z-z) >= .5) failures.push(`${phase} unreachable ${x},${z} end=${JSON.stringify(end)} reached=${JSON.stringify(actual)}`);
    }
    for (const mouse of [true, false]) {
      place(w, from); walk(w, { ...emptyInput(), ...(mouse ? { moveTarget: target } : { move: { x: (x-from.x)/.75, z: (z-from.z)/.75 } }) }, mouse ? 90 : 16);
      const p = w.entities.get(1)!.transform;
      if (Math.hypot(p.x-x,p.z-z) > .4) failures.push(`${phase} ${mouse ? 'click' : 'direct'} ${x},${z} reached ${p.x.toFixed(2)},${p.z.toFixed(2)} command=${JSON.stringify(w.controls.moveTarget)}`);
    }
    sampled++;
  }
  console.info(JSON.stringify({ gate: 'l4-plaza-1m', phase, sampled, failures: failures.length }));
  expect(sampled, phase).toBeGreaterThan(450);
  expect(failures.slice(0, 30), `${failures.length}/${sampled} ${phase} grid failures`).toEqual([]);
  place(w, pose); player.hidden = hidden; w.physics.playerCollider!.setEnabled(!hidden);
}

test('@E22 PO16b visible perimeter holds courier at the reported south edge, all ground actors respect it and infected vault above it; one-metre plaza gate', async () => {
  const { world: w, mission: m } = await loadL4(1);
  try {
    w.combat!.damage.god = true;
    plazaGrid(w, 'ride');
    while (m.state.l4!.phase === 'convoy') w.update();
    m.completeObjective('quartermaster');
    plazaGrid(w, 'plaza');
    while (!m.state.l4!.turnAt) w.update();
    plazaGrid(w, 'hold/war');
    expect(l4PerimeterWalls).toHaveLength(4);
    for (let side = 0; side < 4; side++) {
      const wall = l4PerimeterWalls[side], segments = l4PerimeterSegments.filter(s => s.side === side);
      expect(segments.reduce((sum, s) => sum + s.length, 0)).toBeCloseTo(2 * Math.max(wall.halfX, wall.halfZ));
    }
    // The PO stands at (-11.21, 21.95), against the south edge of the camp.
    const start = { x: -11.21, z: 21.1 };
    place(w, start); w.setInput({ move: { x: 0, z: 1 } });
    for (let i = 0; i < 60; i++) w.update();
    expect(w.entities.get(1)!.transform.z).toBeLessThan(l4.perimeter.z1 - .4);
    expect(w.controls.blockedMove).not.toBeNull();
    expect(m.state.subtitle?.id).toBe('L4.perimeter');
    place(w, start);
    walk(w, { ...emptyInput(), moveTarget: { x: start.x, z: 28 } }, 120);
    expect(w.controls.blockedMove!.point.z).toBeLessThan(l4.perimeter.z1 - .5);
    expect(w.entities.get(1)!.transform.z).toBeLessThan(l4.perimeter.z1 - .4);
    // Enough HP to observe the collision-safe vault without army gunfire ending the fixture.
    const id = w.infected!.spawn('infected.runner', { x: -8.4, z: 19 });
    const runner = w.entities.get(id)!; runner.health = { current: 100000, max: 100000 };
    place(w, { x: -13, z: 19 }); w.clearInput();
    w.update(); expect(runner.infected!.vault).toBeDefined();
    for (let i = 0; i < 73; i++) {
      w.update();
      if (Math.abs(runner.transform.x - l4.perimeter.x1) < .2 + runner.combat!.radius) expect(runner.transform.y - .7, 'feet clear the 1.12 m wire').toBeGreaterThan(1.12);
      expect(w.solids.offenders).toEqual([]);
    }
    expect(runner.transform.x).toBeLessThan(l4.perimeter.x1);
    expect(runner.infected!.vault).toBeUndefined();
  } finally { w.dispose(); }
}, 240000);
