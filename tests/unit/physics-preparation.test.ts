import { expect, test, vi } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../../src/physics/Physics';

test('@transition cold solver preparation preserves the playable world byte for byte', async () => {
  const physics = new Physics(); await physics.init();
  physics.load({ name: 'warm', survivor: true, ground: { width: 30, depth: 30 }, player: { x: 0, y: 1, z: 0 }, walls: [{ x: 3, y: 1, z: 3, halfX: 1, halfY: 1, halfZ: 1 }] });
  const before = physics.world!.takeSnapshot(), restore = vi.spyOn(RAPIER.World, 'restoreSnapshot');
  physics.prepare(); physics.prepare();
  expect(restore).toHaveBeenCalledTimes(1);
  expect(Buffer.from(physics.world!.takeSnapshot()).equals(Buffer.from(before))).toBe(true);
  const reference = RAPIER.World.restoreSnapshot(before);
  try {
    for (let i = 0; i < 5; i++) { physics.update(); reference.step(); }
    expect(Buffer.from(physics.world!.takeSnapshot()).equals(Buffer.from(reference.takeSnapshot()))).toBe(true);
  } finally { restore.mockRestore(); reference.free(); physics.dispose(); }
});
