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
        timeOfDay: i < 3 ? "L1" : i < 5 ? "L4" : "L6",
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
// L3 needs four touching slabs: its original Main Street placement was diagonal
// to the supermarket, leaving a fenced, missing district on the driving route.
compositions.L3.districts[0].origin = [56, 56];
/** The retired M1 map (diner, hardware store, gas forecourt): kept only for its geometry/physics regression suites. */
compositions["L1-M1"] = {
  id: "L1",
  tier: 0,
  timeOfDay: "L1",
  districts: ["D-RES", "D-MAIN", "D-SHOP"].map((id) => ({ id: id as DistrictId, origin: districtOrigins[id as DistrictId] })),
};
