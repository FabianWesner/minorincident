/**
 * Z-fighting check: two triangles that face the same way, lie in one plane within TOLERANCE (1 mm) and overlap
 * with different materials fight for the depth buffer and flicker at the game camera (PO 10-13: bus window line).
 * `coplanarOverlaps` is used by validate.ts for vehicles and buildings; run `npx tsx tools/assets/zfight.ts [id-prefix]`
 * to list offenders across the shipped GLBs (all LODs and decay variants).
 */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Document } from '@gltf-transform/core';
import type { AssetDef } from '../../src/assets/types';
import { variantPath } from '../../src/assets/types';
import { assetIO } from './io';

export const TOLERANCE = 0.001;
/** Overlap smaller than this (m^2, 5 cm2) is a shared edge or a rounding sliver, not a visible fight. */
export const MIN_AREA = 5e-4;
const CELL = 0.005;
const SHADE = 0.04;
/** Same-material overlaps only differ by baked AO, so small patches (< 40 cm2) are invisible; different materials fight from 1 cm2. */
const SAME_MIN_AREA = 4e-3;

export interface Offender { materials: [string, string]; nodes: [string, string]; area: number; at: number[]; normal: number[] }
interface Tri { p: number[][]; n: number[]; d: number; mat: string; node: string; id: number; u: number[][]; box: number[]; glass: boolean; drop: number; shade: number }

function collect(document: Document): Tri[] {
  const tris: Tri[] = [];
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    const at = (x: number, y: number, z: number) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION'), indices = primitive.getIndices();
      if (!position || primitive.getMode() !== 4) continue;
      const material = primitive.getMaterial()?.getName() ?? '', glass = primitive.getMaterial()?.getAlphaMode() === 'BLEND';
      const color = primitive.getAttribute('COLOR_0'), rgba = [0, 0, 0, 0];
      const count = indices?.getCount() ?? position.getCount(), v = [0, 0, 0];
      for (let i = 0; i + 2 < count; i += 3) {
        let shade = 0;
        const p = [0, 1, 2].map(j => {
          const index = indices ? indices.getScalar(i + j) : i + j;
          position.getElement(index, v);
          if (color) { color.getElement(index, rgba); shade += (rgba[0] + rgba[1] + rgba[2]) / 9; }
          return at(v[0], v[1], v[2]);
        });
        const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
        const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], len = Math.hypot(c[0], c[1], c[2]);
        if (len < 1e-9) continue;
        const n = [c[0] / len, c[1] / len, c[2] / len];
        tris.push({ p, n, d: n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2], mat: material, node: node.getName(), id: tris.length, u: [], box: [], glass, drop: 0, shade });
      }
    }
  }
  return tris;
}

/** Project onto the two axes of the plane that are not its dominant normal axis. */
function project(t: Tri): void {
  const a = t.n.map(Math.abs), drop = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
  t.drop = drop;
  const [i, j] = [0, 1, 2].filter(k => k !== drop);
  t.u = t.p.map(q => [q[i], q[j]]);
  t.box = [Math.min(...t.u.map(q => q[0])), Math.min(...t.u.map(q => q[1])), Math.max(...t.u.map(q => q[0])), Math.max(...t.u.map(q => q[1]))];
}
function area(poly: number[][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
/** Sutherland-Hodgman clip of triangle `subject` against convex triangle `clip`; returns the overlap area. */
function overlapPolygon(subject: number[][], clip: number[][]): number[][] {
  const orient = area(clip) >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < 3 && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % 3], input = out;
    out = [];
    const side = (q: number[]) => orient * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
    for (let k = 0; k < input.length; k++) {
      const p = input[k], q = input[(k + 1) % input.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out.length < 3 ? [] : out;
}
/** Is a point 1.5 mm in front of the shared plane unobstructed along the normal? Occluded overlaps (e.g. an end face
 * of a trim strip buried inside the body) can never be seen, and glazing does not occlude. */
function exposed(point: number[], n: number[], tris: Tri[], skip: Set<number>): boolean {
  const o = [point[0] + n[0] * .0015, point[1] + n[1] * .0015, point[2] + n[2] * .0015];
  for (const t of tris) {
    if (t.glass || skip.has(t.id)) continue;
    const [a, b, c] = t.p, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const p = [n[1] * e2[2] - n[2] * e2[1], n[2] * e2[0] - n[0] * e2[2], n[0] * e2[1] - n[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-12) continue;
    const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (n[0] * q[0] + n[1] * q[1] + n[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 1e-4) return false;
  }
  return true;
}

export function coplanarOverlaps(document: Document, tolerance = TOLERANCE, minArea = MIN_AREA): Offender[] {
  const tris = collect(document), buckets = new Map<string, Tri[]>();
  for (const t of tris) {
    const key = t.n.map(c => Math.round(c / CELL)).join(',') + ',' + Math.round(t.d / (tolerance * 2));
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(t);
  }
  // A plane that straddles a distance cell boundary is found through the neighbouring cell.
  const merged = new Map<string, Tri[]>();
  for (const [key, list] of buckets) {
    const parts = key.split(',').map(Number), prefix = parts.slice(0, 3).join(',');
    merged.set(key, [...list, ...(buckets.get(`${prefix},${parts[3] + 1}`) ?? [])]);
  }
  const found = new Map<string, Offender>(), seen = new Set<string>();
  for (const [key, list] of merged) {
    if (list.length < 2) continue;
    for (const t of list) if (!t.u.length) project(t);
    list.sort((a, b) => a.box[0] - b.box[0]);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length && list[j].box[0] < a.box[2]; j++) {
        const b = list[j];
        // Same palette material only fights when the baked vertex AO differs (that is how the old bus rear showed a ragged line).
        if ((a.mat === b.mat && Math.abs(a.shade - b.shade) < SHADE) || Math.abs(a.d - b.d) > tolerance || a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2] < 0.9999) continue;
        if (b.box[1] >= a.box[3] || a.box[1] >= b.box[3]) continue;
        // Undersides face the ground; the game camera never sees them.
        if (a.n[1] < -.7) continue;
        const pair = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        const polygon = overlapPolygon(a.u, b.u), overlap = polygon.length ? Math.abs(area(polygon)) : 0;
        if (overlap < minArea || (a.mat === b.mat && overlap < SAME_MIN_AREA)) continue;
        // centroid of the overlap, lifted back onto the plane
        const cx = polygon.reduce((s, q) => s + q[0], 0) / polygon.length, cy = polygon.reduce((s, q) => s + q[1], 0) / polygon.length;
        const axes = [0, 1, 2].filter(k => k !== a.drop), centre = [0, 0, 0];
        centre[axes[0]] = cx; centre[axes[1]] = cy;
        centre[a.drop] = (a.d - a.n[axes[0]] * cx - a.n[axes[1]] * cy) / a.n[a.drop];
        if (!exposed(centre, a.n, tris, new Set([a.id, b.id]))) continue;
        const mats = [a.mat, b.mat].sort() as [string, string], nodes = [a.node, b.node] as [string, string];
        const id = `${mats.join('|')}|${nodes.sort().join('|')}|${key.split(',').slice(0, 3).join(',')}`;
        const known = found.get(id);
        if (known) known.area += overlap;
        else found.set(id, { materials: mats, nodes, area: overlap, at: centre.map(c => Math.round(c * 1000) / 1000), normal: a.n.map(c => Math.round(c * 100) / 100) });
      }
    }
  }
  return [...found.values()].sort((a, b) => b.area - a.area);
}

/** Offenders that existed when the check was added, counted per model file label (`veh.fire-engine.wrecked:lod0`); a file may not get worse, new ones fail validation. Fix an asset, then lower its entry. */
export function knownZfight(): Record<string, number> {
  const path = 'tools/assets/zfight-known.json';
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}
export function zfightApplies(def: Pick<AssetDef, 'category' | 'id'>): boolean {
  return def.category === 'vehicle' || def.category === 'building';
}
export function zfightErrors(document: Document, def: Pick<AssetDef, 'category' | 'id'>, label: string): string[] {
  if (!zfightApplies(def)) return [];
  const offenders = coplanarOverlaps(document), known = knownZfight()[label] ?? 0;
  if (offenders.length <= known) return [];
  return [`zfight: ${offenders.length} coplanar overlapping material pair(s) within 1 mm, e.g. ${offenders.slice(0, 3).map(o => `${o.materials.join('/')} on ${o.nodes.join('+')} (${(o.area * 1e4).toFixed(0)} cm2)`).join('; ')}`];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prefix = process.argv.find(a => a.startsWith('--prefix='))?.slice(9) ?? '';
  const json = process.argv.includes('--json');
  const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
  const io = await assetIO(), report: Record<string, number> = {};
  for (const def of manifest) {
    if (!zfightApplies(def) || !def.id.startsWith(prefix) || !def.glb) continue;
    for (const decay of [undefined, ...def.decayVariants]) {
      for (const [tier, path] of [def.glb, def.lods?.lod1, def.lods?.lod2].entries()) {
        const file = path && variantPath(path, decay);
        if (!file || !existsSync(file)) continue;
        const offenders = coplanarOverlaps(await io.read(file)), label = `${def.id}${decay ? '.' + decay : ''}:lod${tier}`;
        if (!offenders.length) continue;
        report[label] = offenders.length;
        if (!json) console.log(`${label}: ${offenders.length}\n` + offenders.slice(0, 4).map(o => `   ${o.materials.join(' / ')}  ${o.nodes.join(' + ')}  ${(o.area * 1e4).toFixed(0)} cm2  at ${o.at.join(',')} n ${o.normal.join(',')}`).join('\n'));
      }
    }
  }
  if (json) console.log(JSON.stringify(report, null, 1));
  else console.log(`${Object.keys(report).length} model file(s) with coplanar overlaps`);
}
