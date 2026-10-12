import { l4BreakableLine } from './L4/layout';
import { l4 } from '../data/l4';
import type { DistrictId } from './districts/types';
import type { DistrictWorld } from '../sim/world/DistrictWorld';
import type { BarricadeSlot } from '../sim/interact/Barricades';
/** Core campaign rails, resolved from authored building anchors. Content lanes can add district slots. */
const rails: Record<string, { district: DistrictId; id: string; anchor: string; group: string; width: number; boardUp?: boolean }[]> = {
  'L2': [{ district: 'D-RES', id: 'alvarez-window', anchor: 'safe-house-door', group: 'alvarez', width: 1.4, boardUp: true }, { district: 'D-SCHOOL', id: 'gym-door', anchor: 'gym-door', group: 'gym', width: 2 }],
  'L4': [{ district: 'D-EDGE', id: 'substation-gate', anchor: 'substation-door', group: 'substation', width: 2 }],
};
export function campaignBarricadeSlots(world: DistrictWorld): BarricadeSlot[] {
  if (world.composition.id === 'L4') {
    const d = world.districts.find(d => d.id === 'D-FAIR');
    if (!d) return [];
    const at = (name: string) => { const p = d.layout.anchors[name].position; return { x: p[0] + d.origin[0], z: p[2] + d.origin[1] }; };
    return l4BreakableLine.map(line => ({ id: line.id, groupId: 'l4-line', a: at(line.anchors.a), b: at(line.anchors.b), height: .85, depth: 1.19, initialHp: l4.alphas.lineHp, sandbag: true }));
  }
  return (rails[world.composition.id] ?? []).flatMap(rail => {
    const d = world.districts.find(d => d.id === rail.district && d.layout.anchors[rail.anchor]);
    if (!d) return [];
    const p = d.layout.anchors[rail.anchor].position, x = p[0] + d.origin[0], z = p[2] + d.origin[1];
    return [{ id: rail.id, groupId: rail.group, a: { x: x - rail.width / 2, z }, b: { x: x + rail.width / 2, z }, height: 1, boardUp: rail.boardUp, inward: { x: 0, z: 1 } }];
  });
}
