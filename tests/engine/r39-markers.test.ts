// r39-markers (r38-vqa P2-1/P2-3, P3): objective markers must lead to where the trigger fires.
import { expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { emptyInput } from '../../src/input/InputFrame';
import { l8Route, inRect } from '../../src/data/l8Bosses';
import { l9Course } from '../../src/data/l9';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../../tools/sim-runner/levels';
import { readFixture } from '../../tools/qa/fixture-io';

test('L8 route legs end inside their arena zone, where the fight starts (all six arenas)', () => {
  expect(l8Route.length).toBe(6);
  for (const stage of l8Route) {
    const last = stage.nodes[stage.nodes.length - 1];
    expect(inRect(last, stage.zone), `${stage.id}: last marker node inside its zone`).toBe(true);
    if (stage.entry) expect(Math.hypot(last.x - stage.entry.x, last.z - stage.entry.z), `${stage.id}: node past the entry gate`).toBeLessThan(10);
  }
});

test('L9 bridge: the marker sits on the deck and a held, near-stationary APC on the deck starts the collapse', async () => {
  const decoded = decodeSave(JSON.stringify(readFixture('tests/fixtures/saves/qa/l9-at-bridge.json.br').campaign));
  if (decoded.status !== 'ok') throw new Error('fixture does not decode');
  const world = await loadLevel('L9', 1, decoded.save, 0, { quality: 'low' });
  try {
    const m = world.missions!, l9 = m.l9!;
    expect(l9.driving.state.evacuationDone).toBe(true);
    const marker = markerAnchor(m)!;
    expect(marker.x, 'ring on the deck, not at the gate wall').toBeGreaterThanOrEqual(l9Course.bridge.x);
    expect(marker.x).toBeLessThanOrEqual(l9Course.bridge.endX);
    const car = world.vehicles!.cars.get(l9.state.carId)!, pose = { x: 490, y: car.entity.transform.y, z: 0 };
    car.physics.body.setTranslation(pose, true); car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    Object.assign(car.entity.transform, pose);
    for (let i = 0; i < 30 && l9.state.phase === 'driving'; i++) world.update();
    expect(l9.state.phase, 'standing on the deck is enough').not.toBe('driving');
  } finally { world.dispose(); }
}, 120_000);

// r38-vqa P2-2: an APC pinned between a front barrier, a rear barrier and tight side rails (no room for the reverse three-point turn)
// with the throttle held stayed at 0 m/s for 53 s; the third failed recovery now sets it on the nearest clear pose.
test('L9 APC pinned in a pocket with W held is freed by the stuck recovery', async () => {
  const decoded = decodeSave(JSON.stringify(readFixture('tests/fixtures/saves/qa/l9-at-bridge.json.br').campaign));
  if (decoded.status !== 'ok') throw new Error('fixture does not decode');
  const world = await loadLevel('L9', 1, decoded.save, 0, { quality: 'low' });
  try {
    const l9 = world.missions!.l9!, car = () => world.vehicles!.cars.get(l9.state.carId)!;
    const { x, z } = car().entity.transform;
    for (const [bx, bz, hx, hz, name] of [[x + 6, z, .5, 7, 'front'], [x - 8, z, .5, 7, 'rear'], [x - 1, z + 2.6, 7, .3, 'left'], [x - 1, z - 2.6, 7, .3, 'right']] as const) {
      world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(hx, 1.5, hz).setTranslation(bx, 1.5, bz));
      world.solids.setBarrier(`r39.${name}`, { x: bx, y: 1.5, z: bz, halfX: hx, halfY: 1.5, halfZ: hz } as never);
    }
    let away = 0;
    for (let i = 0; i < 1800 && !away; i++) {
      const frame = emptyInput(); frame.drive = { throttle: 1, steer: 0 } as never; frame.brake = false;
      world.applyInput(frame, 'keyboard'); world.update();
      const t = car().entity.transform;
      if (Math.abs(t.z - z) > 4 || t.x > x + 7 || t.x < x - 9) away = i;
    }
    expect(away, 'the APC left the pocket within 30 s').toBeGreaterThan(0);
  } finally { world.dispose(); }
}, 180_000);
