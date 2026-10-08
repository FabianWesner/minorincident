import { expect, test } from 'vitest';
import { isMissionInteraction } from '../../../src/render/InteractionView';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('parked car interactables get no easter-egg ring while the active objective ring remains', () => {
  // PO requested that optional car and other easter-egg interactions stop drawing ground rings.
  const world = {
    missions: {
      state: { phase: 'playing', steps: { board: { status: 'active' }, optional: { status: 'active' } } },
      def: {
        steps: [
          { id: 'board', complete: { kind: 'interact', anchor: 'truck' } },
          { id: 'optional', complete: { kind: 'interact', anchor: 'car' }, optional: true },
        ],
        anchors: { truck: { x: 4, z: 2 }, car: { x: -8, z: 0 } },
      },
    },
  } as unknown as SimWorld;
  const car = { transform: { x: -8, z: 0 } } as EntitySnapshot;
  const objective = { transform: { x: 4, z: 2 } } as EntitySnapshot;
  expect(isMissionInteraction(world, car)).toBe(false);
  expect(isMissionInteraction(world, objective)).toBe(true);
});
