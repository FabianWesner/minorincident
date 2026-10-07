import type { DistrictId } from './districts/types';
import type { DistrictWorld } from '../sim/world/DistrictWorld';
import type { BarricadeSlot } from '../sim/interact/Barricades';
/** Core campaign rails, resolved from authored building anchors. Content lanes can add district slots. */
const rails: Record<string, { district: DistrictId; id: string; anchor: string; group: string; width: number; boardUp?: boolean }[]> = {
  'L2': [{ district: 'D-RES', id: 'alvarez-window', anchor: 'safe-house-door', group: 'alvarez', width: 1.4, boardUp: true }, { district: 'D-SCHOOL', id: 'gym-door', anchor: 'gym-door', group: 'gym', width: 2 }],
  'L4': [{ district: 'D-EDGE', id: 'substation-gate', anchor: 'substation-door', group: 'substation', width: 2 }],
  'L5': ([['D-RES', 'arrival'], ['D-MAIN', 'fuel-shop-door'], ['D-CIVIC', 'checkpoint-door'], ['D-EDGE', 'exit']] as const).map(([district, anchor], i) => ({ district, id: `fallback-${i + 1}`, anchor, group: `fallback-${i + 1}`, width: 2 })),
};
export function campaignBarricadeSlots(world: DistrictWorld): BarricadeSlot[] {
  return (rails[world.composition.id] ?? []).flatMap(rail => {
    const d = world.districts.find(d => d.id === rail.district && d.layout.anchors[rail.anchor]);
    if (!d) return [];
    const p = d.layout.anchors[rail.anchor].position, x = p[0] + d.origin[0], z = p[2] + d.origin[1];
    return [{ id: rail.id, groupId: rail.group, a: { x: x - rail.width / 2, z }, b: { x: x + rail.width / 2, z }, height: 1, boardUp: rail.boardUp, inward: { x: 0, z: 1 } }];
  });
}
