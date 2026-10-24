import { Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { CivilianCrowd } from '../../../src/render/npc/CivilianCrowd';

test('L4 low skips only an off-screen muzzle pose solve while retaining aim intent', () => {
  const update = vi.fn(), aimGun = vi.fn(), muzzle = new Vector3(1, 2, 3);
  const entity = { id: 17, transform: { x: 40, y: .7, z: 30 }, civilian: { model: 'npc.national-guard' } };
  const visibility = { visible: vi.fn(() => false) };
  const fake = { world: { scenario: 'L4', entities: { get: () => entity } }, low: true, visibility, aimGun,
    batches: [{ model: 'npc.national-guard', update }], muzzle: () => muzzle };
  const run = () => CivilianCrowd.prototype.shotMuzzle.call(fake as unknown as CivilianCrowd, 17, { x: 1, z: 0 });
  expect(run()).toBeNull(); expect(aimGun).toHaveBeenCalledWith(17, { x: 1, z: 0 }); expect(update).not.toHaveBeenCalled();
  visibility.visible.mockReturnValue(true);
  expect(run()).toBe(muzzle); expect(update).toHaveBeenCalled();
  update.mockClear(); visibility.visible.mockReturnValue(false); fake.world.scenario = 'L3';
  expect(run()).toBe(muzzle); expect(update).toHaveBeenCalled();
});
