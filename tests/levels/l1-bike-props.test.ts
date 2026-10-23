import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

type Bike = { riding: boolean; entity: { bicycle: { heading: number } } | undefined; frameFree(x: number, z: number, h: number, o: number): boolean };
/** Q-130: the ridden bike's whole frame box (not just the rider's capsule) must never overlap a solid prop. */
async function mountedBike() {
  const l = await loadL1(1); world = l.world; const w = l.world, bike = w.vehicles!.bicycle as unknown as Bike;
  const at = w.vehicles!.bicycle.entity!.transform, player = w.entities.get(1)!;
  Object.assign(player.transform, { x: at.x, z: at.z }); w.physics.playerBody!.setTranslation(player.transform, true);
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(bike.riding).toBe(true);
  return { w, bike };
}
/** Rides from `from` along `heading` with the key held; returns the ticks on which the frame overlapped a solid. */
function ride(w: SimWorld, bike: Bike, from: { x: number; z: number }, heading: number, ticks = 150): number {
  const p = w.entities.get(1)!.transform, e = bike.entity!;
  Object.assign(p, from); w.physics.playerBody!.setTranslation({ ...from, y: p.y }, true); w.update();
  e.bicycle.heading = heading;
  const dir = { x: Math.cos(heading), z: Math.sin(heading) }; let bad = 0;
  for (let i = 0; i < ticks; i++) {
    w.setInput({ move: dir }); w.update();
    // Same pose the view draws: frame origin at the rider.
    if (bike.riding && !bike.frameFree(p.x, p.z, e.bicycle.heading, 0)) bad++;
  }
  w.clearInput();
  return bad;
}

test('Q-130 riding into the L1 depot-corner hydrant never leaves it inside the bike frame', async () => {
  const { w, bike } = await mountedBike();
  expect(ride(w, bike, { x: -39.8, z: -34.6 }, 0, 360)).toBe(0);
});

const CLASSES = ['fire-hydrant', 'trash-bin', 'recycling-bin', 'street-lamp', 'street-sign', 'mailbox-blue', 'bench', 'bike-rack', 'traffic-cone'];
test('Q-130 riding head-on at every small street prop class from four sides never leaves it inside the bike frame', async () => {
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { placements: { id: string; position: number[] }[] };
  const { w, bike } = await mountedBike(), failures: string[] = []; let rides = 0;
  for (const cls of CLASSES) {
    const props = layout.placements.filter(p => p.id.startsWith(`prop.${cls}:`)).slice(0, 4);
    expect(props.length, cls).toBeGreaterThan(0);
    for (const prop of props) for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const bad = ride(w, bike, { x: prop.position[0] - Math.cos(heading) * 4, z: prop.position[2] - Math.sin(heading) * 4 }, heading); rides++;
      if (bad) failures.push(`${prop.id} heading ${heading.toFixed(2)}: ${bad} ticks`);
    }
  }
  expect(rides).toBeGreaterThan(40);
  expect(failures).toEqual([]);
}, 120_000);
