import type { ScenarioDefinition } from '../../../src/levels/loader';
/** 600 metre course; cone chicanes are authored by the vehicle scenario system. */
export const driveCourse: ScenarioDefinition = { name: 'drive-course', survivor: true, combat: true, ground: { width: 800, depth: 80, center: { x: 300, z: 0 } }, player: { x: .2, y: .705, z: 1.45 } };
