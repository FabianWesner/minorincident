import { anchor, type DistrictGameplay } from "./types";
/** L8 uses the intact W0 zoo for sanctuary and outbreak; damage is live, not pre-dressed.
 * Named gates/animal centres/service anchors are consumed by subsequent encounter lanes.
 */
export const gameplay: DistrictGameplay = {
  id: "D-ZOO",
  playerStart: anchor("player-start"),
  spawns: [anchor("arrival"), { x: -5, z: 10 }],
  spawnVolumes: [{ center: anchor("arrival"), radius: 2 }],
  triggers: [{ id: "arrival", position: anchor("arrival"), radius: 3 }],
  objectives: [
    { id: "landmark", position: anchor("zoo-entrance") },
    { id: "exit", position: anchor("exit") },
  ],
  interactables: [{ id: "landmark-door", position: anchor("zoo-entrance") }],
  civilianRoutes: [
    [anchor("arrival"), { x: 24, z: 64 }, { x: 24, z: 0 }, { x: -24, z: 0 }, { x: -24, z: 64 }, anchor("arrival")],
    [{ x: -96, z: -64 }, { x: 96, z: -64 }, { x: 96, z: 0 }, { x: -96, z: 0 }, { x: -96, z: -64 }],
    [{ x: -96, z: 0 }, { x: 96, z: 0 }, { x: 96, z: 64 }, { x: -96, z: 64 }, { x: -96, z: 0 }],
  ],
  safePoints: [anchor("safe-point"), anchor("exit")],
  photoSpots: [
    { name: "overview", target: { x: 0, z: 0 }, offset: [150, 160, 150] },
    { name: "landmark", target: anchor("zoo-entrance"), offset: [20, 24, 22] },
    ...["pair-zoo-gate", "pair-zoo-lion", "pair-zoo-gorilla", "pair-zoo-service-yard", "l8-safe-paths"].map(name => ({ name, target: anchor(name), offset: [24, 28, 24] as [number, number, number] })),
  ],
  decay: [],
};
