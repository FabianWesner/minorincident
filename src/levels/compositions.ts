import { districtIds, type LevelComposition, type DistrictId } from './districts/types';
/** Neighbouring district slabs touch at boundaries; all connected roads are available from load. */
export const districtOrigins: Record<DistrictId, [number, number]> = Object.fromEntries(districtIds.map((id, i) => [id, [(i % 2) * 56, Math.floor(i / 2) * 56]])) as Record<DistrictId, [number, number]>;
const ids = [['D-RES', 'D-MAIN', 'D-SHOP'], ['D-RES', 'D-SCHOOL', 'D-SHOP'], ['D-CIVIC', 'D-PARK'], ['D-CIVIC', 'D-ZOO', 'D-EDGE'], ['D-CIVIC'], [...districtIds]] as DistrictId[][];
export const compositions: Record<string, LevelComposition> = Object.fromEntries(ids.map((districts, i) => [`L${i + 1}`, {
  id: `L${i + 1}`, tier: i as LevelComposition['tier'], timeOfDay: i < 3 ? 'L1' : i < 5 ? 'L4' : 'L6',
  districts: districts.map((id) => ({ id, origin: districtOrigins[id] })),
}]));
