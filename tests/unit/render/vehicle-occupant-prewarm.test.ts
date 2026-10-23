import { afterEach, expect, test, vi } from 'vitest';
import { Group } from 'three/webgpu';
import { VehicleView } from '../../../src/render/VehicleView';
import { VehicleOccupant } from '../../../src/render/characters/VehicleOccupant';

afterEach(() => vi.restoreAllMocks());
test('L2 boarding reuses the actor rigs warmed during loading instead of loading and disposing temporary copies', async () => {
  const model = new Group(), seat = new Group(); seat.name = 'driverSeat'; model.add(seat);
  const entities = [{ id: 1, survivor: { variant: 'female' } }, { id: 8, health: { current: 10 }, civilian: { model: 'npc.firefighter-alive' } }];
  const occupants = new Map<number, VehicleOccupant>();
  const made: (Group & { actorId: number; pose: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> })[] = [];
  const load = vi.spyOn(VehicleOccupant, 'load').mockImplementation(async (_registry, actorId) => {
    const copy = Object.assign(new Group(), { actorId, pose: vi.fn(), dispose: vi.fn() }); made.push(copy); return copy as unknown as VehicleOccupant;
  });
  const view = { world: { missions: { state: { l2: { truckId: 5, crewIds: [8] } } }, vehicles: { cars: new Map([[5, { entity: { id: 5 }, physics: { def: {} } }]]) }, entities: { get: (id: number) => entities.find(e => e.id === id), iterate: () => entities } }, records: new Map([[5, { model }]]), occupants, registry: {}, materials: {} };
  const restore = await VehicleView.prototype.prewarmOccupants.call(view as unknown as VehicleView);
  expect(load.mock.calls.map(c => c[1])).toEqual([1, 8]);
  expect(made.every(copy => copy.parent === model && copy.pose.mock.calls[0][0] === seat)).toBe(true);
  restore!(); restore!();
  expect([...occupants.keys()]).toEqual([1, 8]);
  for (const copy of made) { expect(occupants.get(copy.actorId)).toBe(copy); expect(copy.dispose).not.toHaveBeenCalled(); expect(copy.parent).toBeNull(); expect(copy.visible).toBe(false); }
});
