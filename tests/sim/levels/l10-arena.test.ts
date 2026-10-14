import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { cure } from '../../../src/levels/L10/district';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';
import { arena, step } from '../combat/helpers';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;

test('T-E32-17-D4-play @E32-AC17 @E32-AC18 walk from the R7 checkpoint to console, climb stairs and mount the shipped gun', async () => {
  const w = await arena(); w.loadComposition(compositions.L10, [layout], 32);
  const p = w.entities.get(1)!;
  // Fixture starts at the existing region checkpoint; every subsequent metre uses player movement and streamed physics.
  const [x,z] = cure.anchors['cure-complex'];
  Object.assign(p.transform, { x, z, y: .705 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
  const walk = (target: Point) => {
    w.clearInput(); w.setInput({ moveTarget: { x: target[0], z: target[1] }, navigation: true, pointerGround: true });
    let ticks = 0;
    while (Math.hypot(p.transform.x - target[0], p.transform.z - target[1]) > .45 && ticks++ < 2400) step(w, 1);
    expect(Math.hypot(p.transform.x - target[0], p.transform.z - target[1]), JSON.stringify({ target, at: p.transform })).toBeLessThanOrEqual(.45);
  };
  for (const point of cure.regions[6].route.slice(1)) walk(point);
  walk([4004.5,-30]); walk([4004.5,-33]); walk(cure.anchors['dispersal-stair-foot']);
  // Explicit direction keeps the stair ascent on its narrow treads.
  w.clearInput(); w.setInput({ move: { x: -1, z: 0 } });
  for (let i = 0; i < 300 && p.transform.x > 3990.8; i++) step(w, 1);
  w.clearInput(); step(w, 2);
  expect(p.transform.y).toBeGreaterThan(3.6);
  expect(w.mountedGun!.canMount(), JSON.stringify(p.transform)).toBe(true);
  w.setInput({ interact: true }); step(w, 1); w.clearInput(); step(w, 1);
  expect(w.mountedGun!.mounted).toBe(true);
}, 60_000);
