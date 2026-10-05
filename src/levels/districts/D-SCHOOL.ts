import { anchor, type DistrictGameplay } from "./types";
/** D-SCHOOL: gameplay-only data. Edits do not invalidate the Blender layout cache. */
export const gameplay: DistrictGameplay = {
  id: "D-SCHOOL",
  playerStart: anchor("player-start"),
  spawns: [anchor("arrival"), { x: -5, z: 10 }],
  spawnVolumes: [{ center: anchor("arrival"), radius: 2 }],
  triggers: [{ id: "arrival", position: anchor("arrival"), radius: 3 }],
  objectives: [
    { id: "landmark", position: anchor("school-entrance") },
    { id: "exit", position: anchor("exit") },
  ],
  interactables: [{ id: "landmark-door", position: anchor("school-entrance") }],
  civilianRoutes: [[anchor("arrival"), anchor("safe-point"), anchor("exit")]],
  safePoints: [anchor("safe-point")],
  photoSpots: [
    { name: "overview", target: { x: 0, z: 0 }, offset: [45, 48, 45] },
    {
      name: "landmark",
      target: anchor("school-entrance"),
      offset: [20, 24, 22],
    },
  ],
  decay: [
    {
      tier: 3,
      blockers: [{ min: [-3, 0, 16], max: [2, 1, 18] }],
      fires: [{ position: { x: -10, z: -9 }, radius: 1.7, damagePerSecond: 8 }],
      powerOut: ["block-0", "block-2"],
    },
    {
      tier: 4,
      blockers: [{ min: [5, 0, -20], max: [7, 1, -18] }],
      fires: [{ position: { x: 10, z: -10 }, radius: 2, damagePerSecond: 10 }],
      powerOut: [],
    },
    {
      tier: 5,
      blockers: [],
      fires: [{ position: { x: 13, z: 10 }, radius: 2.5, damagePerSecond: 12 }],
      powerOut: ["block-1", "block-3"],
    },
  ],
};
