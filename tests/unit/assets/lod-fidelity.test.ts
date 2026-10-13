import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import baseline from './lod-fidelity.baseline.json';

/**
 * PO 2026-10-13 "Low zoom. Bank isn't fully rendered": the low tier draws every prop at LOD2, close zoom at LOD1, and LOD sheets
 * only ever covered the assets a lane touched. Automated LOD fidelity for ALL static props, buildings and static vehicles:
 * against LOD0, each LOD keeps (1) the bounding box (per axis within 12 %), (2) every material that carries > 5 % of the
 * LOD0 surface (at least 5 % of its area survives; ratios are reported), and (3) the silhouette from the game-camera directions (top, front, side and the
 * 45-degree game view; 48 px rasters, IoU >= 0.8): no part disappears. Report: test-results/lod-fidelity.json.
 * The 40 assets failing on 2026-10-13 are listed in lod-fidelity.baseline.json (asset backlog); a new defect fails the gate.
 */
type Def = { id: string; category: string; glb: string; lods?: Record<string, string> };
const defs = ((Array.isArray(manifest) ? manifest : (manifest as { assets: Def[] }).assets) as Def[]).filter(d => d.lods && ['prop', 'building', 'vehicle'].includes(d.category));

async function load(path: string): Promise<Object3D> {
  const bytes = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
interface Summary { box: Box3; area: Map<string, number>; total: number; tris: Float32Array }
function summarize(root: Object3D): Summary {
  root.updateMatrixWorld(true);
  const box = new Box3(), area = new Map<string, number>(), list: number[] = [], a = new Vector3(), b = new Vector3(), c = new Vector3();
  let total = 0;
  root.traverse(node => {
    if (!(node instanceof Mesh) || !node.visible) return;
    const p = node.geometry.getAttribute('position'), index = node.geometry.index, count = index ? index.count : p.count;
    const materials = (Array.isArray(node.material) ? node.material : [node.material]) as Material[];
    const groups = node.geometry.groups.length ? node.geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const g of groups) {
      const name = materials[g.materialIndex ?? 0]?.name ?? '?';
      for (let t = g.start; t < g.start + g.count; t += 3) {
        const at = (k: number) => index ? index.getX(t + k) : t + k;
        a.fromBufferAttribute(p, at(0)).applyMatrix4(node.matrixWorld); b.fromBufferAttribute(p, at(1)).applyMatrix4(node.matrixWorld); c.fromBufferAttribute(p, at(2)).applyMatrix4(node.matrixWorld);
        box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        const s = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() / 2;
        area.set(name, (area.get(name) ?? 0) + s); total += s;
        list.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    }
  });
  return { box, area, total, tris: Float32Array.from(list) };
}
/** Orthographic coverage raster of the triangles projected along `dir` (unit), framed by the LOD0 box. */
function raster(s: Float32Array, frame: Box3, u: Vector3, v: Vector3, n = 48): Uint8Array {
  const corners = [0, 1].flatMap(x => [0, 1].flatMap(y => [0, 1].map(z => new Vector3(x ? frame.max.x : frame.min.x, y ? frame.max.y : frame.min.y, z ? frame.max.z : frame.min.z))));
  const us = corners.map(p => p.dot(u)), vs = corners.map(p => p.dot(v)), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const su = (n - 1) / Math.max(1e-6, u1 - u0), sv = (n - 1) / Math.max(1e-6, v1 - v0), out = new Uint8Array(n * n), p = new Vector3();
  for (let i = 0; i < s.length; i += 9) {
    const pts = [0, 3, 6].map(k => { p.set(s[i + k], s[i + k + 1], s[i + k + 2]); return [(p.dot(u) - u0) * su, (p.dot(v) - v0) * sv]; });
    const minX = Math.max(0, Math.floor(Math.min(...pts.map(q => q[0])))), maxX = Math.min(n - 1, Math.ceil(Math.max(...pts.map(q => q[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...pts.map(q => q[1])))), maxY = Math.min(n - 1, Math.ceil(Math.max(...pts.map(q => q[1]))));
    const [[ax, ay], [bx, by], [cx, cy]] = pts, d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(d) < 1e-9) { for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) if (maxX - minX <= 1 || maxY - minY <= 1) out[y * n + x] = 1; continue; }
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + .5, py = y + .5, w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d, w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d, w2 = 1 - w0 - w1;
      if (w0 >= -.02 && w1 >= -.02 && w2 >= -.02) out[y * n + x] = 1;
    }
  }
  return out;
}
const views: [string, Vector3, Vector3][] = [
  ['top', new Vector3(1, 0, 0), new Vector3(0, 0, 1)], ['front', new Vector3(0, 0, 1), new Vector3(0, 1, 0)], ['side', new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
  ['game', new Vector3(1, 0, -1).normalize(), new Vector3(.5, .81, .5).normalize().cross(new Vector3(1, 0, -1).normalize()).normalize()],
];
const report: Record<string, unknown> = {};
for (const def of defs) test(`@E18 LOD fidelity ${def.id}`, async () => {
  const base = summarize(await load(def.glb)), problems: string[] = [], size = base.box.getSize(new Vector3());
  const entry: Record<string, unknown> = {};
  for (const [lod, path] of Object.entries(def.lods!)) {
    const s = summarize(await load(path)), sz = s.box.getSize(new Vector3()), info: Record<string, number> = {};
    for (const axis of ['x', 'y', 'z'] as const) if (size[axis] > .05 && Math.abs(sz[axis] - size[axis]) / size[axis] > .12) problems.push(`${lod} ${axis} extent ${sz[axis].toFixed(2)} vs ${size[axis].toFixed(2)}`);
    // Decimation legitimately drops hidden faces (area ratios are reported, not gated); a whole visible material vanishing is a lost part.
    for (const [name, area] of base.area) { info[`area:${name}`] = +((s.area.get(name) ?? 0) / area).toFixed(2); if (area > base.total * .05 && (s.area.get(name) ?? 0) < area * .05) problems.push(`${lod} material ${name} gone (${((s.area.get(name) ?? 0) / area * 100).toFixed(0)} % of LOD0 area)`); }
    for (const [view, u, v] of views) {
      const a = raster(base.tris, base.box, u, v), b = raster(s.tris, base.box, u, v);
      let inter = 0, union = 0; for (let i = 0; i < a.length; i++) { inter += a[i] & b[i]; union += a[i] | b[i]; }
      const iou = union ? inter / union : 1; info[view] = +iou.toFixed(3);
      if (iou < .8) problems.push(`${lod} ${view} silhouette IoU ${iou.toFixed(2)}`);
    }
    entry[lod] = info;
  }
  report[def.id] = { ...entry, problems };
  mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/lod-fidelity.json', JSON.stringify(report, null, 1));
  // Known defects (backlog, tests/unit/assets/lod-fidelity.baseline.json) are reported; any new one fails.
  const known = new Set((baseline.assets as Record<string, string[]>)[def.id] ?? []), kind = (p: string) => p.replace(/ (IoU|extent|gone).*$/, ' $1');
  expect(problems.filter(p => !known.has(kind(p))), def.id).toEqual([]);
}, 60_000);
