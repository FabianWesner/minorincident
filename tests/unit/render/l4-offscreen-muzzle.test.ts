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

test('L4 cached model membership retains live people and refreshes births and restores', () => {
  const first = { id: 17, civilian: { model: 'npc.national-guard' }, transform: { x: 1 } };
  let entities = [first];
  const update = vi.fn(), discover = vi.fn();
  const fake = {
    world: { scenario: 'L4', tick: 1, entities: { revision: 0, iterate: () => entities, get: () => first } },
    figureRevision: -1, footwork: { begin: vi.fn() }, visibility: { begin: vi.fn() },
    budgetNear: vi.fn(), discover, selectHeroes: vi.fn(), staged: false,
    props: { begin: vi.fn(), finish: vi.fn(), aiming: new Map() },
    figures: new Map(), batches: [{ model: 'npc.national-guard', update }], low: true,
  };
  const run = () => CivilianCrowd.prototype.update.call(fake as unknown as CivilianCrowd);
  run(); expect(discover).toHaveBeenCalledTimes(1);
  const list = update.mock.calls.at(-1)![3]; expect(list).toEqual([first]);
  first.transform.x = 2; run();
  expect(discover).toHaveBeenCalledTimes(1); expect(update.mock.calls.at(-1)![3]).toBe(list);
  expect(list[0].transform.x).toBe(2);
  Object.assign(first, { civilian: undefined, appearance: { asset: 'npc.national-guard' } }); run();
  expect(discover).toHaveBeenCalledTimes(1); expect(list[0]).toBe(first);
  const born = { ...first, id: 18 }; entities.push(born); fake.world.entities.revision++; run();
  expect(discover).toHaveBeenCalledTimes(2); expect(list.map((e: { id: number }) => e.id)).toEqual([17, 18]);
  entities = [{ ...first, transform: { x: 9 } }]; fake.world.entities.revision++; run();
  expect(discover).toHaveBeenCalledTimes(3); expect(list).toEqual(entities);
  fake.world.scenario = 'L3'; run(); run(); expect(discover).toHaveBeenCalledTimes(5);
});
