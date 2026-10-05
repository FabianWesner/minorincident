import type { ScenarioDefinition } from '../../../src/levels/loader';
const base: ScenarioDefinition = { name: 'survivor', survivor: true, ground: { width: 100, depth: 100 }, player: { x: 0, y: 0.705, z: 0 } };
export const survivorScenarios: Record<string, ScenarioDefinition> = {
  survivor: base,
  'survivor-ring': { ...base, name: 'survivor-ring', walls: [
    { x: 5.2, y: 1, z: 0, halfX: 0.2, halfY: 1, halfZ: 5.4 },
    { x: -5.2, y: 1, z: 0, halfX: 0.2, halfY: 1, halfZ: 5.4 },
    { x: 0, y: 1, z: 5.2, halfX: 5.4, halfY: 1, halfZ: 0.2 },
    { x: 0, y: 1, z: -5.2, halfX: 5.4, halfY: 1, halfZ: 0.2 },
  ] },
};
