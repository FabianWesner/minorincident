import { expect, test } from 'vitest';
import { arena, dummy } from './helpers';

test('projectile assistance preserves deliberate interception lead while direct and hitscan aim retain body snap', async () => {
  const w = await arena(), p = w.entities.get(1)!;
  const id = dummy(w, p.transform.x + 9, p.transform.z), e = w.entities.get(id)!;
  e.motion = { velocity: { x: 0, z: 3.15 }, speed: 3.15, moving: true, distance: 0 };
  const lead = { x: Math.sqrt(1 - (3.15 / 18) ** 2), z: 3.15 / 18 };
  const projectile = { ...lead };
  w.combat!.assist.apply(1, p.transform, projectile, 35, 18);
  expect(projectile).toEqual(lead);
  const direct = { x: 1, z: 0 };
  w.combat!.assist.apply(1, p.transform, direct, 35, 18);
  expect(direct).toEqual({ x: 1, z: 0 });
  const hitscan = { ...lead };
  w.combat!.assist.apply(1, p.transform, hitscan, 35);
  expect(hitscan).toEqual({ x: 1, z: 0 });
});
