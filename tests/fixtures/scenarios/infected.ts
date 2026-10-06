import type { ScenarioDefinition } from '../../../src/levels/loader';
const arena: ScenarioDefinition = { name: 'horde-arena', ground: { width: 120, depth: 120 }, player: { x: 0, y: 0.705, z: 0 }, survivor: true, combat: true, infected: true };
export const infectedScenarios: Record<string, ScenarioDefinition> = {
  'horde-arena': arena,
  'animal-lab': { ...arena, name: 'animal-lab', perches: [{ x: 5.1, z: 0, y: 2.2 }] },
  'horde-readability': { ...arena, name: 'horde-readability' },
  'offset-horde': { ...arena, name: 'offset-horde', ground: { width: 30, depth: 20, center: { x: 100, z: 50 } }, player: { x: 105, y: 0.705, z: 50 }, walls: [{ x: 100, y: 1, z: 50, halfX: 0.4, halfY: 1, halfZ: 5 }] },
  maze: { ...arena, name: 'maze', player: { x: 20, y: 0.705, z: 0 }, ground: { width: 60, depth: 20 }, navigation: [
    { id: 'west', center: { x: -20, z: 0 }, width: 20, depth: 20, links: [{ to: 'middle', x: -9, z: 3 }] },
    { id: 'middle', center: { x: 0, z: 0 }, width: 20, depth: 20, links: [{ to: 'west', x: -11, z: 3 }, { to: 'east', x: 11, z: 3 }] },
    { id: 'east', center: { x: 20, z: 0 }, width: 20, depth: 20, links: [{ to: 'middle', x: 9, z: 3 }] },
  ], walls: [
    { x: -10, y: 1, z: -4, halfX: 0.4, halfY: 1, halfZ: 5 },
    { x: 0, y: 1, z: 4, halfX: 0.4, halfY: 1, halfZ: 5 },
    { x: 10, y: 1, z: -4, halfX: 0.4, halfY: 1, halfZ: 5 },
  ] },
};
