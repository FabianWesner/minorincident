import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { l2 } from '../../../src/data/l2';
import { missionControls } from '../../../src/sim/missions/controls';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { arena, equip, fire, step } from './helpers';

/** PO 10-09: a normal L2 infected (40 HP runner) takes 3 fire-axe, 4 bat and 6 fist hits to go down; L1 keeps its one-swing axe kill. */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

async function l2World(): Promise<SimWorld> {
  const w = new SimWorld(); world = w; await w.init();
  const composition = compositions.L2;
  w.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  w.loadMission(resolveCampaignMission('L2', w.districts!));
  missionControls(w).begin();
  w.storyLock = null;
  return w;
}

/** Swings `weapon` at a runner in front of the courier until it drops; returns the number of melee hits that landed on it. */
function hitsToDown(w: SimWorld, weapon: string): number {
  const player = w.entities.get(1)!;
  equip(w, [weapon]);
  const id = w.spawnDummy('infected.runner', { x: player.transform.x + 1.2, z: player.transform.z }, { hp: 40, radius: .35 });
  const target = w.entities.get(id)!;
  const landed = () => w.events.events().filter(e => e.type === 'combat.hit' && e.targetId === id).length;
  // Each hit shoves the dummy out of reach, so put it back in front of the courier before every swing.
  for (let swing = 0; swing < 20 && target.health.current > 0; swing++) {
    Object.assign(target.transform, { x: player.transform.x + 1.2, z: player.transform.z }); w.spatial.set(id, target.transform.x, target.transform.z);
    fire(w, 'LEFT', { x: 1, z: 0 }); step(w, 90);
  }
  expect(target.health.current, `${weapon} downs the runner`).toBe(0);
  return landed();
}

test('L1 arena: hits-to-down unchanged (axe 1, bat 2, fists 7 on main since click-attack); no L2 melee table is set', async () => {
  const w = await arena();
  expect(w.infectedMeleeHits).toBeNull();
  expect(hitsToDown(w, 'weapon.fire-axe')).toBe(1);
  expect(hitsToDown(w, 'weapon.bat')).toBe(2);
  expect(hitsToDown(w, 'weapon.fists')).toBe(7);
});

test('L2 mission: the level carries its melee table; a normal runner needs 3 axe, 4 bat, 8 fist hits', async () => {
  const w = await l2World();
  expect(w.infectedMeleeHits).toEqual(l2.infectedMeleeHits);
  expect(hitsToDown(w, 'weapon.fire-axe')).toBe(3);
  expect(hitsToDown(w, 'weapon.bat')).toBe(4);
  expect(hitsToDown(w, 'weapon.fists')).toBe(8);
});

test('L2 mission: one bat roundhouse over a crowd of three downs none of them', async () => {
  const w = await l2World(), player = w.entities.get(1)!;
  equip(w, ['weapon.bat']);
  const ids = [0, 1, 2].map(i => w.spawnDummy('infected.runner', { x: player.transform.x + Math.cos(i * 2.1) * 1.1, z: player.transform.z + Math.sin(i * 2.1) * 1.1 }, { hp: 40, radius: .35 }));
  fire(w, 'LEFT', { x: 1, z: 0 });
  step(w, 90);
  for (const id of ids) expect(w.entities.get(id)!.health.current).toBeGreaterThan(0);
});
