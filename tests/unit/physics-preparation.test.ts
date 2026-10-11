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

test('@transition resetting physics prepares the replacement world once', async () => {
  const physics = new Physics(); await physics.init();
  const scenario = { name: 'warm', survivor: true, ground: { width: 30, depth: 30 }, player: { x: 0, y: 1, z: 0 } };
  const restore = vi.spyOn(RAPIER.World, 'restoreSnapshot');
  try {
    for (let load = 0; load < 2; load++) {
      physics.load(scenario);
      const before = physics.world!.takeSnapshot();
      physics.prepare(); physics.prepare();
      expect(restore).toHaveBeenCalledTimes(load + 1);
      expect(Buffer.from(physics.world!.takeSnapshot())).toEqual(Buffer.from(before));
    }
  } finally { restore.mockRestore(); physics.dispose(); }
});

test('@transition rigid worlds skip tear scans and retain topology fallback', async () => {
  const physics = new Physics(); await physics.init();
  physics.load({ name: 'mapping', survivor: true, ground: { width: 30, depth: 30 }, player: { x: 0, y: 1, z: 0 } });
  const world = physics.world!, scan = vi.spyOn(world.colliders, 'mapNewColliders');
  const reference = RAPIER.World.restoreSnapshot(world.takeSnapshot());
  try {
    for (let i = 0; i < 5; i++) { physics.update(); reference.step(); }
    expect(scan).not.toHaveBeenCalled();
    expect(Buffer.from(world.takeSnapshot())).toEqual(Buffer.from(reference.takeSnapshot()));
    const count = world.bodies.raw.len(), rawCount = vi.spyOn(world.bodies.raw, 'len').mockReturnValue(count + 1);
    physics.update(); expect(scan).toHaveBeenCalledOnce(); rawCount.mockRestore();
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(2, 2, 2));
    world.createCollider(RAPIER.ColliderDesc.ball(.2), body);
    physics.update(); expect(world.getRigidBody(body.handle)).toBe(body);
    world.removeRigidBody(body); physics.update(); expect(world.getRigidBody(body.handle)).toBeNull();
  } finally { scan.mockRestore(); reference.free(); physics.dispose(); }
});
