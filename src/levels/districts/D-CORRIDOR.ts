import { anchor, type DistrictGameplay } from "./types";
/**
 * D-CORRIDOR (E21 L3): gameplay-only data for the corridor layout. The L3 mission (src/levels/L3/mission.ts) and its
 * controller own every set piece; the L3 layout copy (src/levels/L3/layout.ts) adds the gameplay anchors and dressing.
 * Photo spots are composition overrides (src/levels/compositions.ts), since their anchors exist only in that copy.
 */
export const gameplay: DistrictGameplay = {
  id: "D-CORRIDOR",
  playerStart: anchor("player-start"),
  spawns: [anchor("player-start")],
  spawnVolumes: [{ center: anchor("player-start"), radius: 1 }],
  triggers: [],
  // The route up Commerce Street from the station yard to the army zone line (patrol bots and objective reachability, E10-AC02).
  objectives: [
    { id: "yard", position: { x: -134, z: 1.5 } }, { id: "segment-1", position: { x: -90, z: 0 } }, { id: "segment-2", position: { x: -10, z: 0 } },
    { id: "segment-3", position: { x: 60, z: 0 } }, { id: "commerce-east", position: { x: 85, z: -3.4 } }, { id: "army-gate", position: { x: 133, z: 0 } },
  ],
  interactables: [],
  civilianRoutes: [],
  safePoints: [],
  photoSpots: [],
  decay: [],
};
