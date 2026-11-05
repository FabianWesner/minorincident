import type { ScenarioDefinition } from '../../../src/levels/loader';

/** Render-only street fixture; gameplay entity/collider ownership remains with later epics. */
export const lookdev: ScenarioDefinition = { name: 'lookdev', ground: { width: 100, depth: 100 }, player: { x: 0, y: 0.5, z: 0 } };
export const photoSpots = {
  overview: { position: [22, 22.5, 22], target: [0, 0, 0] },
  street: { position: [14, 12, 18], target: [0, 0.4, -2] },
  'shadow-probe': { position: [-3, 9, 7], target: [-5, 0, -5] },
} satisfies Record<string, { position: [number, number, number]; target: [number, number, number] }>;
export const infectedPositions: [number, number][] = [[-3, 1], [2, -3], [3.5, 0.5], [-2, -2], [1, 3]];
