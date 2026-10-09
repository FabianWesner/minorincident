import { anchor, type DistrictGameplay } from "./types";
/**
 * D-FAIR (E22 L4 Fairhaven downtown): gameplay-only data for the layout. The L4 mission (src/levels/L4/mission.ts) and its
 * controller own every set piece; the L4 layout copy (src/levels/L4/layout.ts) adds the gameplay anchors and the army dressing.
 * Photo spots are composition overrides (src/levels/compositions.ts), since their anchors exist only in that copy.
 */
export const gameplay: DistrictGameplay = {
  id: "D-FAIR",
  playerStart: anchor("player-start"),
  spawns: [anchor("player-start")],
  spawnVolumes: [{ center: anchor("player-start"), radius: 1 }],
  triggers: [],
  // Both routes from the plaza to Kessler Lane (patrol bots and objective reachability, E10-AC02).
  objectives: [
    { id: "plaza", position: { x: -17, z: 3 } }, { id: "harbor", position: { x: -12, z: -37.4 } }, { id: "metro-road", position: { x: 50, z: -4 } },
    { id: "kessler-lane", position: { x: 62, z: 28.6 } }, { id: "lakeshore", position: { x: -12, z: 44 } },
  ],
  interactables: [],
  civilianRoutes: [],
  safePoints: [],
  photoSpots: [],
  decay: [],
};
