import { anchor, type DistrictGameplay } from "./types";
/**
 * D-GROVE (L1 v2): gameplay-only data on the L0 skeleton layout. Lane A refines the layout; lane E wires objectives and
 * interactions through the L1 mission (src/levels/missions.ts), so this table only carries the static markers.
 */
export const gameplay: DistrictGameplay = {
  id: "D-GROVE",
  playerStart: anchor("player-start"),
  spawns: [anchor("player-start")],
  spawnVolumes: [{ center: anchor("player-start"), radius: 1 }],
  triggers: [
    { id: "lab-forecourt", position: anchor("lab-gate"), radius: 4 },
    { id: "fire-bay", position: anchor("fire-bay-trigger"), radius: 2 },
  ],
  objectives: [
    { id: "pickup", position: anchor("parcel-counter") },
    { id: "deliver", position: anchor("lab-door") },
    { id: "bat", position: anchor("garage-bat") },
    { id: "fire-station", position: anchor("fire-bay-trigger") },
  ],
  interactables: [
    { id: "parcel-counter", position: anchor("parcel-counter") },
    { id: "lab-door", position: anchor("lab-door") },
    { id: "garage-bat", position: anchor("garage-bat") },
  ],
  civilianRoutes: [[anchor("bus-stop"), anchor("cafe-patio"), anchor("parcel-door")]],
  safePoints: [anchor("fire-bay-trigger")],
  photoSpots: [
    ["l1-morning", [24, 28, 24]],
    ["l1-pickup", [18, 22, 18]],
    ["l1-facility", [22, 26, 22]],
    ["l1-accident", [18, 22, 18]],
    ["l1-escape", [22, 26, 22]],
    ["l1-spread", [22, 26, 22]],
    ["l1-garage", [18, 22, 18]],
    ["l1-horde", [24, 28, 24]],
    ["l1-safe", [16, 20, 16]],
  ].map(([name, offset]) => ({
    name: name as string,
    target: anchor(`photo-${name}`),
    offset: offset as [number, number, number],
  })),
  decay: [],
};
