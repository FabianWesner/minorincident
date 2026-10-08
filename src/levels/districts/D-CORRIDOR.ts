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
  objectives: [],
  interactables: [],
  civilianRoutes: [],
  safePoints: [],
  photoSpots: [],
  decay: [],
};
