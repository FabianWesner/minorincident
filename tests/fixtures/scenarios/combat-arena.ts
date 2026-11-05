import type { ScenarioDefinition } from '../../../src/levels/loader';
/** 30×30 m isolated arena. Infected are stationary, configurable sim dummies, never AI bodies. */
export const combatArena: ScenarioDefinition = {
  name: 'combat-arena', survivor: true, combat: true, ground: { width: 30, depth: 30 }, player: { x: 0, y: 0.705, z: 0 },
  walls: [
    { x: 15.2, y: 1, z: 0, halfX: 0.2, halfY: 1, halfZ: 15.4 },
    { x: -15.2, y: 1, z: 0, halfX: 0.2, halfY: 1, halfZ: 15.4 },
    { x: 0, y: 1, z: 15.2, halfX: 15.4, halfY: 1, halfZ: 0.2 },
    { x: 0, y: 1, z: -15.2, halfX: 15.4, halfY: 1, halfZ: 0.2 },
  ],
};

/** E06 category telegraphs fit entirely in this deterministic arena photo spot. */
export const combatPhotoSpots = { aim: { position: [22, 26, 22] as [number, number, number], target: [4, 0.7, 2] as [number, number, number] } };
