import semantic from './destructionParts.json';
import { worldAssets } from '../assets/worldDefinitions';
import { staticCollision } from '../assets/staticCollision';
import type { Aabb, Placement } from '../levels/districts/types';
import type { DestructionMaterial } from './destruction';
export type DestructionClass = 'timber' | 'masonry' | 'concrete' | 'vehicle' | 'wood-prop' | 'metal-prop';
export interface DestructionPolicy { class: DestructionClass; indestructible?: boolean }
export interface DestructionPart { id: string; role: 'glass' | 'door' | 'roof' | 'structure'; material: DestructionMaterial; hp: number; bounds: Aabb }
export const destructionClasses: Record<DestructionClass, { material: DestructionMaterial; hp: number; burnTicks: number; collapse: number }> = {
  timber: { material: 'wood', hp: 85, burnTicks: 720, collapse: .35 },
  masonry: { material: 'brick', hp: 140, burnTicks: 0, collapse: .5 },
  concrete: { material: 'concrete', hp: 260, burnTicks: 0, collapse: .7 },
  vehicle: { material: 'metal', hp: 90, burnTicks: 300, collapse: .6 },
  'wood-prop': { material: 'wood', hp: 45, burnTicks: 360, collapse: 1 },
  'metal-prop': { material: 'metal', hp: 100, burnTicks: 0, collapse: 1 },
};
export function contains(box: Aabb, p: readonly number[], margin = 0): boolean { return p.every((v, i) => v >= box.min[i] - margin && v <= box.max[i] + margin); }
export function intersection(a: Aabb, b: Aabb): Aabb | null {
  const min = a.min.map((v, i) => Math.max(v, b.min[i])) as Aabb['min'], max = a.max.map((v, i) => Math.min(v, b.max[i])) as Aabb['max'];
  return min.every((v, i) => max[i] - v > .001) ? { min, max } : null;
}
/** Disjoint remainder, also used to partition collision exactly at door/window boundaries. */
export function subtractBox(box: Aabb, cut: Aabb): Aabb[] {
  const hit = intersection(box, cut); if (!hit) return [box];
  const rest: Aabb[] = [], core = { min: [...box.min] as Aabb['min'], max: [...box.max] as Aabb['max'] };
  for (let axis = 0; axis < 3; axis++) for (const side of ['min', 'max'] as const) {
    if (Math.abs(core[side][axis] - hit[side][axis]) < .001) continue;
    const piece = { min: [...core.min] as Aabb['min'], max: [...core.max] as Aabb['max'] };
    piece[side === 'min' ? 'max' : 'min'][axis] = hit[side][axis]; rest.push(piece); core[side][axis] = hit[side][axis];
  }
  return rest;
}
export function destructionParts(p: Pick<Placement, 'assetId' | 'destruction'>): DestructionPart[] {
  const policy = p.destruction!, def = destructionClasses[policy.class], d = worldAssets[p.assetId]?.dimensions;
  if (!d) throw new Error(`Missing destruction bounds: ${p.assetId}`);
  const entries = (semantic as Record<string, { name: string; role: string; min: number[]; max: number[] }[]>)[p.assetId] ?? [];
  const parts: DestructionPart[] = entries.slice().sort((a, b) => (a.role === 'glass' ? 0 : a.role === 'door' ? 1 : 2) - (b.role === 'glass' ? 0 : b.role === 'door' ? 1 : 2)).map(e => ({
    id: e.name, role: e.role as DestructionPart['role'], material: e.role === 'glass' ? 'glass' : def.material,
    hp: e.role === 'glass' ? 6 : e.role === 'door' ? policy.class === 'vehicle' ? 45 : 35 : def.hp,
    bounds: { min: e.min.map(v => v - .035) as Aabb['min'], max: e.max.map(v => v + .035) as Aabb['max'] },
  }));
  if (policy.class === 'vehicle' && !parts.length) {
    // Optimized vehicle GLBs retain empty seat/door anchors; these shared zones bound the cabin and panels.
    for (const side of [-1, 1]) {
      parts.push({ id: `glass-side-${side}`, role: 'glass', material: 'glass', hp: 6,
        bounds: { min: [-d.x*.22,d.y*.57,side*d.z*.35-.12], max: [d.x*.23,d.y*.91,side*d.z*.35+.12] } });
      parts.push({ id: `glass-end-${side}`, role: 'glass', material: 'glass', hp: 6,
        bounds: { min: [side*d.x*.25-.23,d.y*.57,-d.z*.35], max: [side*d.x*.25+.23,d.y*.91,d.z*.35] } });
    }
    for (const side of [-1, 1]) for (const end of [-1, 1]) parts.push({ id: `door-${side}-${end}`, role: 'door', material: 'metal', hp: 45,
      bounds: { min: [end*d.x*.12-d.x*.12,d.y*.23,side*d.z*.4-.15], max: [end*d.x*.12+d.x*.12,d.y*.75,side*d.z*.4+.15] } });
  }
  if (!parts.some(p => p.role === 'roof') && !policy.class.includes('prop') && policy.class !== 'vehicle') parts.push({ id: 'roof', role: 'roof', material: def.material, hp: def.hp, bounds: { min: [-d.x, d.y * .65, -d.z], max: [d.x, d.y + .2, d.z] } });
  // A small fixed grid bounds both state and first-damage splitting cost. Each cell can breach independently.
  const nx = policy.class === 'vehicle' ? 3 : 4, nz = policy.class === 'vehicle' ? 2 : 4;
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) parts.push({ id: `shell-${x}-${z}`, role: 'structure', material: def.material, hp: def.hp,
    bounds: { min: [-d.x / 2 + d.x * x / nx, -.2, -d.z / 2 + d.z * z / nz], max: [-d.x / 2 + d.x * (x + 1) / nx, d.y + .2, -d.z / 2 + d.z * (z + 1) / nz] } });
  const occupied = new Set(partColliders(p.assetId, parts).map(c => c.part));
  return parts.filter((part, i) => part.role !== 'structure' || occupied.has(i));
}
export function partAt(parts: readonly DestructionPart[], point: readonly number[]): number { return parts.findIndex(p => contains(p.bounds, point, .001)); }
/** Exact owned portions of the original compound collider; ground supports remain immutable. */
export function partColliders(assetId: string, parts: readonly DestructionPart[]): { part: number; box: Aabb }[] {
  const result: { part: number; box: Aabb }[] = [];
  for (const box of staticCollision[assetId]?.boxes ?? []) {
    if (box.max[1] < .45) continue;
    let remaining = [box];
    for (const [part, def] of parts.entries()) {
      const next: Aabb[] = [];
      for (const piece of remaining) { const hit = intersection(piece, def.bounds); if (hit) result.push({ part, box: hit }); next.push(...subtractBox(piece, def.bounds)); }
      remaining = next;
    }
  }
  return result;
}
