import type { ScenarioDefinition } from '../../../src/levels/loader';
/** Small deterministic E11 integration yard; scene assets use the production registry. */
export const interactYard: ScenarioDefinition = {
  name: 'interact-yard', survivor: true, combat: true,
  ground: { width: 40, depth: 40 }, player: { x: 0, y: .705, z: 0 },
  devices: [{ kind: 'generator', position: { x: 0, z: 1 }, options: { fuel: 20, holdTime: 4, label: 'Start generator' } },
    { kind: 'door', position: { x: 5, z: 0 }, options: { key: 'key.house', label: 'Open gate' } }],
  hazards: [{ kind: 'propane', position: { x: 8, z: 0 } }, { kind: 'propane', position: { x: 12, z: 0 } },
    { kind: 'car-alarm', position: { x: -6, z: 0 } }, { kind: 'fence', position: { x: 2, z: -4 } },
    { kind: 'crate', position: { x: 8, z: 2 } }],
  pickups: [{ kind: 'item', item: 'key.house', position: { x: 3, z: 0 } }, { kind: 'medkit', position: { x: -3, z: 0 } }],
};
