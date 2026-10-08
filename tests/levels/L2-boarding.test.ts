import { afterEach, describe, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL2 } from '../../tools/sim-runner/l2Bots';

/** PO 10-08: the axe took several tries and boarding "did nothing". One click-to-move from the apron must be enough, on every seed. */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

async function atAlarm(seed: number) {
  const l = await loadL2(seed); world = l.world;
  for (let i = 0; i < 60 * 45 && l.mission.state.l2!.phase === 'calm'; i++) l.world.update();
  expect(l.mission.state.l2!.phase).toBe('alarm');
  for (let i = 0; i < 90; i++) l.world.update();
  return l;
}
/** One click: a single moveTarget frame, then hands off. Returns ticks until `done`. */
function clickAndWait(w: SimWorld, target: { x: number; z: number }, done: () => boolean, maxTicks = 60 * 25): number {
  w.setInput({ moveTarget: { x: target.x, z: target.z } }); w.update(); w.setInput({ moveTarget: undefined });
  let n = 1; while (n < maxTicks && !done()) { w.update(); n++; }
  return n;
}

describe('L2 one-attempt interactions', () => {
  test('axe: one click on the rack picks it up (20 seeds)', async () => {
    const times: number[] = [];
    for (const seed of seeds) {
      const l = await atAlarm(seed), a = l.mission.def.anchors['l2-axe-rack'];
      times.push(clickAndWait(l.world, a, () => l.mission.state.l2!.axe));
      expect(l.mission.state.l2!.axe, `seed ${seed}`).toBe(true);
      l.world.dispose(); world = undefined;
    }
    console.log('axe ticks', times.join(','));
  }, 600_000);

  test('truck: one click on the boarding ring boards (20 seeds), axe first on seeds 1-4', async () => {
    const times: number[] = [];
    for (const seed of seeds) {
      for (const axeFirst of seed <= 4 ? [false, true] : [false]) {
        const l = await atAlarm(seed), a = l.mission.def.anchors;
        if (axeFirst) clickAndWait(l.world, a['l2-axe-rack'], () => l.mission.state.l2!.axe);
        times.push(clickAndWait(l.world, a['l2-board'], () => l.mission.state.l2!.seated));
        expect(l.mission.state.l2!.seated, `seed ${seed} axeFirst ${axeFirst}`).toBe(true);
        l.world.dispose(); world = undefined;
      }
    }
    console.log('board ticks', times.join(','));
  }, 600_000);

  test('standing anywhere in a ring counts: hold at the edge, and E from the edge', async () => {
    for (const seed of [1, 2, 3]) for (const name of ['l2-board', 'l2-axe-rack']) for (const press of [false, true]) {
      const l = await atAlarm(seed), a = l.mission.def.anchors[name], p = l.world.entities.get(1)!.transform;
      p.x = a.x + a.radius * .92; p.z = a.z;
      const done = () => name === 'l2-board' ? l.mission.state.l2!.seated : l.mission.state.l2!.axe;
      for (let i = 0; i < 150 && !done(); i++) { l.world.setInput({ interact: press }); l.world.update(); }
      expect(done(), `${name} seed ${seed} press ${press}`).toBe(true);
      l.world.dispose(); world = undefined;
    }
  }, 600_000);
});
