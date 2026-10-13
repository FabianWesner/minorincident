import { l6PhotoSpots } from '../data/l6';
import {
  districtIds,
  groveDistrictId,
  corridorDistrictId,
  fairDistrictId,
  type LevelComposition,
  type DistrictId,
} from "./districts/types";
import { l3PhotoSpots } from "../data/l3";
import { l4PhotoSpots } from "../data/l4";
import { l5PhotoSpots } from "../data/l5";
/** Neighbouring district slabs touch at boundaries; all connected roads are available from load. */
export const districtOrigins: Record<DistrictId, [number, number]> =
  Object.fromEntries([
    ...districtIds.map((id, i) => [id, [(i % 2) * 56, Math.floor(i / 2) * 56]]),
    [groveDistrictId, [0, 0]],
    [corridorDistrictId, [0, 0]],
    [fairDistrictId, [0, 0]],
    ["D-CROSSING", [0, 0]],
  ]) as Record<DistrictId, [number, number]>;
const ids = [
  ["D-RES", "D-MAIN", "D-SHOP"],
  ["D-RES", "D-SCHOOL", "D-SHOP", "D-PARK"],
  ["D-MAIN", "D-SHOP", "D-PARK", "D-CIVIC"],
  ["D-CIVIC", "D-ZOO", "D-EDGE"],
  ["D-RES", "D-MAIN", "D-SCHOOL", "D-CIVIC", "D-PARK", "D-EDGE"],
  [...districtIds],
] as DistrictId[][];
export const compositions: Record<string, LevelComposition> =
  Object.fromEntries(
    ids.map((districts, i) => [
      `L${i + 1}`,
      {
        id: `L${i + 1}`,
        tier: i as LevelComposition["tier"],
        // E25 level moods (specs/06 §2): L1 morning, L2 midday, L3 afternoon (below), L4 golden hour, L5 dusk, L6 night.
        timeOfDay: (["L1", "L2", "L1", "L4", "L5", "L6"] as const)[i],
        districts: districts.map((id) => ({ id, origin: districtOrigins[id] })),
      },
    ]),
  );
/** Isolated district compositions for authoring/photo/perf probes; campaign composition stays unchanged. */
for (const id of districtIds)
  compositions[id] = {
    id,
    tier: 0,
    timeOfDay: "L1",
    districts: [{ id, origin: [0, 0] }],
  };
/** L1 v2: D-GROVE alone, centred on the origin. `L1` is the campaign level id (NPC/combat install keys on it), `D-GROVE` the isolated probe. */
compositions[groveDistrictId] = {
  id: groveDistrictId,
  tier: 0,
  timeOfDay: "L1",
  districts: [{ id: groveDistrictId, origin: [0, 0] }],
};
compositions.L1 = { ...compositions[groveDistrictId], id: "L1" };
/** L2 "The Failed Rescue" (E20): the same town a few hours later, midday, W1 dressing authored in `levels/L2/layout.ts`. */
compositions.L2 = {
  id: "L2", tier: 1, timeOfDay: "L2",
  districts: [{ id: groveDistrictId, origin: [0, 0], overrides: { photoSpots: ([
    ["l2-station-calm", [10, 14, 10]], ["l2-alarm", [10, 14, 10]], ["l2-truck-ride", [24, 28, 24]], ["l2-doors-open", [18, 22, 18]],
    ["l2-collapse", [16, 19, 16]], ["l2-streets-w1", [18, 22, 18]], ["l2-cluster", [22, 26, 22]], ["l2-bridge-checkpoint", [18, 22, 18]],
  ] as const).map(([name, offset]) => ({ name, target: { anchor: `photo-${name}` }, offset: [...offset] as [number, number, number] })) } }],
};
/** L3 "The Police Collapse" (E21): the D-CORRIDOR avenues, late afternoon, W2/W3 variants authored in its layout. */
compositions.L3 = {
  id: "L3", tier: 2, timeOfDay: "L3",
  districts: [{ id: corridorDistrictId, origin: [0, 0], overrides: { photoSpots: l3PhotoSpots.map(([name, offset]) => ({ name, target: { anchor: `photo-${name}` }, offset: [...offset] as [number, number, number] })) } }],
};
compositions[corridorDistrictId] = { id: corridorDistrictId, tier: 2, timeOfDay: "L3", districts: [{ id: corridorDistrictId, origin: [0, 0] }] };
/** L4 "The Safe City Falls" (E22): Fairhaven downtown, clean and alive (W0), golden afternoon; the war damage is live (E27 blasts, fires), never authored. */
compositions.L4 = {
  id: "L4", tier: 0, timeOfDay: "L4",
  districts: [{ id: fairDistrictId, origin: [0, 0], overrides: { photoSpots: l4PhotoSpots.map(([name, offset]) => ({ name, target: { anchor: name.startsWith("pair-") ? name : `photo-${name}` }, offset: [...offset] as [number, number, number] })) } }],
};
/** L5 "Aftermath" (E23): the same streets hours later, W5 (devastated, power out) at sunset; the twin is authored in `levels/L5/layout.ts`. */
compositions.L5 = {
  id: "L5", tier: 5, timeOfDay: "L5",
  districts: [{ id: fairDistrictId, origin: [0, 0], overrides: { photoSpots: l5PhotoSpots.map(([name, offset]) => ({ name, target: { anchor: name.startsWith("pair-") ? name : `photo-${name}` }, offset: [...offset] as [number, number, number] })) } }],
};
compositions[fairDistrictId] = { id: fairDistrictId, tier: 3, timeOfDay: "L4", districts: [{ id: fairDistrictId, origin: [0, 0] }] };
/** E25 `night-street` / perf: L1's town (W0, all blocks powered) at night. */
compositions["night-street"] = { ...compositions[groveDistrictId], id: "night-street", timeOfDay: "night" };
/** The retired M1 map (diner, hardware store, gas forecourt): kept only for its geometry/physics regression suites. */
compositions["L1-M1"] = {
  id: "L1",
  tier: 0,
  timeOfDay: "L1",
  districts: ["D-RES", "D-MAIN", "D-SHOP"].map((id) => ({ id: id as DistrictId, origin: districtOrigins[id as DistrictId] })),
};

/** E24: Lakeshore shelter, 216 m track tunnel, Northgate and the night exit. */
compositions.L6 = { id: "L6", tier: 0, timeOfDay: "L6-subway", districts: [{ id: "D-SUBWAY", origin: [0, 0], overrides: { photoSpots: l6PhotoSpots.map(([name]) => ({ name, target: { anchor: `photo-${name}` }, offset: name === "l6-exit-night" ? [30, 38, 30] : [20, 24, 20] })) } }] };
compositions["D-SUBWAY"] = { ...compositions.L6, id: "D-SUBWAY" };

/** L7-D1: retained Fairhaven W6, shared Northgate exit; D2 adds corridor/bus. */
compositions.L7 = { id: 'L7', tier: 6, timeOfDay: 'L6', districts: [{ id: fairDistrictId, origin: [0, 0], overrides: { spawns: [{ anchor: 'l7-night-exit' }] } }] };

/** Isolated L9-D1 greybox; mission registration belongs to the systems/encounter lanes. */
compositions["D-CROSSING"] = { id: "D-CROSSING", tier: 0, timeOfDay: "L9-crossing", districts: [{ id: "D-CROSSING", origin: [0, 0] }] };

/** E30 sanctuary uses the intact zoo and its powered night lights. */
compositions.L8 = { id: 'L8', tier: 0, timeOfDay: 'L8-zoo', districts: [{ id: 'D-ZOO', origin: [0, 0] }] };
/** The zoo's transport arrives before any crossing population is installed. */
compositions.L9 = { ...compositions['D-CROSSING'], id: 'L9' };
