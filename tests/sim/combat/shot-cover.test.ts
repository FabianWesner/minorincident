import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { allyState, updateAlly } from '../../../src/sim/outbreak/Allies';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import { l3 } from '../../../src/data/l3';
import { loadL3 } from '../../../tools/sim-runner/l3Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const barrier: CoverWall = { x: 3, y: 1.5, z: 0, halfX: .25, halfY: 1.5, halfZ: 10 };
async function setup() {
  world = new SimWorld(); await world.init(); world.loadScenario('turning-probe', 1);
  const w = world, target = w.entities.get(w.infected!.spawn('infected.runner', { x: 12, z: 0 }))!;
  (w.combat!.query.walls as CoverWall[]).push({ ...barrier });
  return { w, target };
}

test.each(['officer', 'soldier', 'civilian'] as const)('@E21 shot cover: ground %s cannot hit through a 3 m wall; tower shooter can', async role => {
  const { w, target } = await setup();
  target.transform.x = 5; w.spatial.set(target.id, 5, 0);
  w.entities.get(1)!.transform.x = 4.5;
  (w.combat!.query.walls as CoverWall[])[0].x = 1;
  const e = w.entities.get(w.npcs!.civilians.spawn(role, { x: 0, z: 0 }, { waypoints: [{ x: 0, z: 0 }] }))!;
  e.civilian!.ally = { ...allyState(role, e.transform, true), engaged: true,
    gun: { damage: 25, shotS: .1, rangeM: 26, nearM: 26, hitNear: 1, hitFar: 1 } };
  const shot = () => {
    const a = e.civilian!.ally!;
    // A target cached before cover appeared must also be rechecked at discharge.
    a.targetId = target.id; a.strikeTarget = target.id; a.strikeAt = w.tick;
    updateAlly(w, e, () => true);
  };
  w.tick = 10; shot(); expect(target.health.current).toBe(target.health.max);
  e.transform.y = l3.soldiers.deckY + .7;
  expect(w.combat!.query.shotVisible(e.transform, target.transform)).toBe(true);
  shot(); expect(target.health.current).toBe(target.health.max - 25);
  // A taller building still blocks elevated riflemen.
  (w.combat!.query.walls as CoverWall[])[0].halfY = 5;
  (w.combat!.query.walls as CoverWall[])[0].y = 5;
  const hp = target.health.current; shot(); expect(target.health.current).toBe(hp);
});

test('@E21 player bullets and explicit muzzle rays stop at world and dynamic cover', async () => {
  const { w, target } = await setup();
  const query = w.combat!.query;
  expect(query.ray(1, { x: 0, y: 1.15, z: 0 }, { x: 1, z: 0 }, 20)).toBeNull();
  expect(query.clearDistance({ x: 0, y: 4, z: 0 }, { x: 1, y: -3 / 12, z: 0 }, 12)).toBe(12);
  expect(query.clearDistance({ x: 0, y: 4, z: 0 }, { x: 1, y: -3 / 4, z: 0 }, 12)).toBeCloseTo(2.75);
  (query.walls as CoverWall[]).length = 0;
  (query.dynamicWalls as CoverWall[]).push({ ...barrier });
  expect(query.shotVisible(w.entities.get(1)!.transform, target.transform)).toBe(false);
});

test('@E21 checkpoint guard feet stay on all four tower decks', async () => {
  const loaded = await loadL3(1); world = loaded.world;
  const guards = loaded.mission.state.l3!.soldierIds.map(id => world!.entities.get(id)!);
  expect(guards).toHaveLength(8);
  for (const e of guards) {
    expect(e.transform.y - .7).toBeCloseTo(l3.soldiers.deckY);
    expect(e.transform.x).toBe(138.5);
    expect(e.civilian!.ally?.weapon).toBe('rifle');
  }
  for (let i = 0; i < 60; i++) world.update();
  for (const e of guards) expect(e.transform.y - .7).toBeCloseTo(l3.soldiers.deckY);
}, 120_000);
