import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { DistrictView } from '../../../src/render/DistrictView';

test('army boom applies its open pose when the checkpoint streams in after the yard', () => {
  const hero = { pose: vi.fn() }, near = { pose: vi.fn() }, far = { pose: vi.fn() };
  const ref = new Group(), entries: unknown[] = [];
  const view = { lodBatches: entries } as unknown as DistrictView;
  DistrictView.prototype.updateArmyBoom.call(view, 1);
  entries.push({ id: 'kit.army-checkpoint', refs: [ref], hero, near, far });
  DistrictView.prototype.updateArmyBoom.call(view, 1);
  for (const group of [hero, near, far]) {
    expect(group.pose).toHaveBeenCalledWith('gateArm', Math.PI / 2, ref, 'x');
    expect(group.pose).toHaveBeenCalledTimes(1);
  }
  DistrictView.prototype.updateArmyBoom.call(view, 1);
  expect(hero.pose).toHaveBeenCalledTimes(1);
  DistrictView.prototype.updateArmyBoom.call(view, 0);
  expect(hero.pose).toHaveBeenLastCalledWith('gateArm', 0, ref, 'x');
});
