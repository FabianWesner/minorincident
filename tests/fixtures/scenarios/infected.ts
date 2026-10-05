import type { ScenarioDefinition } from '../../../src/levels/loader';
const arena: ScenarioDefinition = { name: 'horde-arena', ground: { width: 120, depth: 120 }, player: { x: 0, y: 0.705, z: 0 }, survivor: true, combat: true, infected: true };
export const infectedScenarios: Record<string, ScenarioDefinition> = {
  'horde-arena': arena,
  'horde-readability': { ...arena, name: 'horde-readability' },
  maze: { ...arena, name: 'maze', player: { x: 20, y: 0.705, z: 0 }, ground: { width: 60, depth: 20 }, walls: [
    { x: -10, y: 1, z: -4, halfX: 0.4, halfY: 1, halfZ: 5 },
    { x: 0, y: 1, z: 4, halfX: 0.4, halfY: 1, halfZ: 5 },
    { x: 10, y: 1, z: -4, halfX: 0.4, halfY: 1, halfZ: 5 },
  ] },
};
