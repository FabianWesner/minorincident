import type { ScenarioDefinition } from '../../../src/levels/loader';

/** E01 fixture: a 100 × 100 m XZ plane and a falling player/debug cube. */
export const empty: ScenarioDefinition = {
  name: 'empty',
  ground: { width: 100, depth: 100 },
  player: { x: 0, y: 2, z: 0 },
};
