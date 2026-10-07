import {
  districtIds,
  groveDistrictId,
  type LevelComposition,
  type DistrictId,
} from "./districts/types";
/** Neighbouring district slabs touch at boundaries; all connected roads are available from load. */
export const districtOrigins: Record<DistrictId, [number, number]> =
  Object.fromEntries([
    ...districtIds.map((id, i) => [id, [(i % 2) * 56, Math.floor(i / 2) * 56]]),
    [groveDistrictId, [0, 0]],
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
    ["l2-collapse", [20, 24, 20]], ["l2-streets-w1", [18, 22, 18]], ["l2-cluster", [22, 26, 22]], ["l2-bridge-checkpoint", [18, 22, 18]],
  ] as const).map(([name, offset]) => ({ name, target: { anchor: `photo-${name}` }, offset: [...offset] as [number, number, number] })) } }],
};
// L3 road loop: Main → supermarket → park → Civic. Override only this
// composition; the other campaigns retain their original district placement.
compositions.L3.districts = [
  { id: 'D-MAIN', origin: [56, 56] }, { id: 'D-SHOP', origin: [0, 56] },
  { id: 'D-PARK', origin: [0, 112] }, { id: 'D-CIVIC', origin: [56, 112] },
];
compositions.L3.timeOfDay = 'L3';
for (const district of compositions.L3.districts) district.overrides = { spawns: [{ anchor: 'arrival' }, { x: 0, z: -20 }] };
/** E25 `night-street` / perf: L1's town (W0, all blocks powered) at night. */
compositions["night-street"] = { ...compositions[groveDistrictId], id: "night-street", timeOfDay: "night" };
/** The retired M1 map (diner, hardware store, gas forecourt): kept only for its geometry/physics regression suites. */
compositions["L1-M1"] = {
  id: "L1",
  tier: 0,
  timeOfDay: "L1",
  districts: ["D-RES", "D-MAIN", "D-SHOP"].map((id) => ({ id: id as DistrictId, origin: districtOrigins[id as DistrictId] })),
};
