import { expect, test } from 'vitest';
import { groveWorld, step } from './l1-grove';

/**
 * PO 2026-10-15 "Dog looks broken" (repeat of 10-14 "that dog looks strange"): a walked pet dog keeps the civilian
 * 0.7 m transform height of its spawn while it moves, as NpcView draws it (root = y - 0.7). Only the corgi companion stands at
 * 0.3 m. At 0.3 the moving dog was drawn 40 cm into the pavement: its legs vanished, the paws lay as separate blobs and the buried
 * legs' sun shadow smeared out from under the body.
 */
test('@E08 a moving pet dog stays at the civilian height above the ground', async () => {
  const { w } = await groveWorld(1);
  let moving = 0;
  for (let t = 0; t < 30 * 60; t++) {
    step(w, 1);
    for (const e of w.entities.iterate()) {
      if (e.civilian?.pet !== 'dog' || e.hidden || !e.motion?.moving) continue;
      expect(e.transform.y - w.districts!.groundHeight(e.transform.x, e.transform.z), `pet ${e.id} at tick ${w.tick}`).toBeCloseTo(.7, 2);
      moving++;
    }
    for (const e of w.entities.iterate()) if (e.companion && e.motion?.moving) expect(e.transform.y - w.districts!.groundHeight(e.transform.x, e.transform.z)).toBeCloseTo(.3, 2);
  }
  expect(moving, 'no walked pet dog moved in 30 s').toBeGreaterThan(60);
});
