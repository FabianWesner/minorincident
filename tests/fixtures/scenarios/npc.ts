import type { ScenarioDefinition } from '../../../src/levels/loader';
const street: ScenarioDefinition = { name: 'civ-street', survivor: true, combat: true, infected: true, ground: { width: 100, depth: 80 }, player: { x: 0, y: .705, z: 0 }, npcs: { ambient: 30, companion: true } };
export const npcScenarios: Record<string, ScenarioDefinition> = {
  'civ-street': street,
  'turning-probe': { ...street, name: 'turning-probe', npcs: { ambient: 0 } },
};
