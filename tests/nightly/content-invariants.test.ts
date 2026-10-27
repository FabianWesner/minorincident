// Nightly content invariants (PO 10-13 "This isn't a bug that I should ever face"): baseline ratchets over ALL assets and
// districts. Known backlog lives in the baseline files next to this test; any NEW offender fails. Not per-change: they
// decode every GLB/layout and take minutes. Reports: test-results/{lod-fidelity,placement-offenders}.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, test } from 'vitest';
import manifest from '../../src/assets/manifest.json';
import { compositions } from '../../src/levels/compositions';
import { decorationAllowed, strayDecorations } from '../../src/levels/districts/decorationSurface';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { solidOverlaps } from '../../src/levels/placementClearance';
import { stripStrayDecorations } from '../../src/render/decorationFilter';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stripGlbTextures } from '../../tools/assets/stripGlbTextures';
import lodBaseline from './lod-fidelity.baseline.json';

const layoutFiles = readdirSync('public/assets/layouts').filter(f => f.endsWith('.layout.json'));
const loadLayout = (f: string) => JSON.parse(readFileSync(`public/assets/layouts/${f}`, 'utf8')) as DistrictLayout;
async function loadGlb(data: ArrayBuffer): Promise<Object3D> {
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data, '')).scene;
}

// --- LOD fidelity: every LOD of every static prop/building/vehicle keeps LOD0's extent, visible materials and silhouette.
type Def = { id: string; category: string; glb: string; lods?: Record<string, string> };
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
/** Orthographic coverage raster of the triangles projected along (u, v), framed by the LOD0 box. */
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

test('LOD fidelity: every static asset LOD keeps LOD0 extent (12 %), visible materials and game-camera silhouettes (IoU 0.8)', async () => {
  const defs = ((Array.isArray(manifest) ? manifest : (manifest as { assets: Def[] }).assets) as Def[]).filter(d => d.lods && ['prop', 'building', 'vehicle'].includes(d.category));
  const report: Record<string, unknown> = {}, fresh: string[] = [];
  const known = lodBaseline.assets as Record<string, string[]>, kind = (p: string) => p.replace(/ (IoU|extent|gone).*$/, ' $1');
  for (const def of defs) {
    const base = summarize(await loadGlb(stripGlbTextures(readFileSync(def.glb)))), size = base.box.getSize(new Vector3()), problems: string[] = [];
    for (const [lod, path] of Object.entries(def.lods!)) {
      const s = summarize(await loadGlb(stripGlbTextures(readFileSync(path)))), sz = s.box.getSize(new Vector3());
      for (const axis of ['x', 'y', 'z'] as const) if (size[axis] > .05 && Math.abs(sz[axis] - size[axis]) / size[axis] > .12) problems.push(`${lod} ${axis} extent ${sz[axis].toFixed(2)} vs ${size[axis].toFixed(2)}`);
      for (const [name, area] of base.area) if (area > base.total * .05 && (s.area.get(name) ?? 0) < area * .05) problems.push(`${lod} material ${name} gone (${((s.area.get(name) ?? 0) / area * 100).toFixed(0)} % of LOD0 area)`);
      for (const [view, u, v] of views) {
        const a = raster(base.tris, base.box, u, v), b = raster(s.tris, base.box, u, v);
        let inter = 0, union = 0; for (let i = 0; i < a.length; i++) { inter += a[i] & b[i]; union += a[i] | b[i]; }
        const iou = union ? inter / union : 1;
        if (iou < .8) problems.push(`${lod} ${view} silhouette IoU ${iou.toFixed(2)}`);
      }
    }
    report[def.id] = problems;
    const allowed = new Set(known[def.id] ?? []);
    for (const p of problems) if (!allowed.has(kind(p))) fresh.push(`${def.id}: ${p}`);
  }
  mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/lod-fidelity.json', JSON.stringify(report, null, 1));
  expect(fresh).toEqual([]);
}, 900_000);

// --- PO 10-13 "Flowers growing on stone": after the render filter every drawn daisy stands on soil, in every district and tier.
test('decoration surfaces: drawn decorations stand only on soil in every district and world tier', async () => {
  const daisy = (o: Object3D) => { for (let n: Object3D | null = o; n; n = n.parent) if (n.name === 'daisy' || n.name.startsWith('daisy_')) return true; return false; };
  const bad: string[] = [];
  for (const file of layoutFiles) {
    const layout = loadLayout(file), decorations = layout.decorations ?? [];
    if (!decorations.length) continue;
    const stray = strayDecorations(layout).length;
    for (const tier of ['base', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6']) {
      const path = `public/assets/layouts/${file.replace('.layout.json', '')}.${tier}.glb`;
      if (!existsSync(path)) continue;
      const bytes = readFileSync(path), scene = await loadGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      const removed = stripStrayDecorations(scene, layout);
      if (tier === 'base' && removed !== stray) bad.push(`${file}: removed ${removed} of ${stray} stray decorations`);
      const a = new Vector3();
      scene.updateMatrixWorld(true);
      scene.traverse(node => {
        if (!(node instanceof Mesh) || !daisy(node)) return;
        const p = node.geometry.getAttribute('position'), index = node.geometry.index!;
        for (let t = 0; t < index.count; t += 3) {
          a.set(0, 0, 0); for (let k = 0; k < 3; k++) a.add(new Vector3().fromBufferAttribute(p, index.getX(t + k)).applyMatrix4(node.matrixWorld)); a.divideScalar(3);
          let best = -1, distance = .3;
          decorations.forEach((d, i) => { const e = Math.hypot(d.position[0] - a.x, d.position[2] - a.z); if (e < distance) { distance = e; best = i; } });
          if (best < 0) bad.push(`${file} ${tier}: orphan daisy at (${a.x.toFixed(2)}, ${a.z.toFixed(2)})`);
          else if (!decorationAllowed(layout, decorations[best])) bad.push(`${file} ${tier}: daisy on ${decorations[best].position.map(v => v.toFixed(2)).join(',')}`);
        }
      });
    }
  }
  expect([...new Set(bad)].slice(0, 20)).toEqual([]);
}, 900_000);

// --- PO 10-13 "Corgi sunken": no raised walkable top has a narrow seam that point-sampled actors drop into.
test('support seams: raised walkable supports have no seam an actor sinks into, every district', async () => {
  const seams: string[] = [];
  for (const file of layoutFiles) {
    const id = file.replace('.layout.json', ''), composition = compositions[id];
    if (!composition) continue;
    const w = new SimWorld(); await w.init(); w.loadComposition(composition, [loadLayout(file)], 1);
    try {
      const d = w.districts!;
      for (const district of d.districts) for (const c of district.decay.colliders) {
        if (!c.walkable || c.aabb.max[1] < .05 || Math.min(c.aabb.max[0] - c.aabb.min[0], c.aabb.max[2] - c.aabb.min[2]) < .3) continue;
        const top = c.aabb.max[1], [x0, , z0] = c.aabb.min.map((v, i) => v + (i === 0 ? district.origin[0] : i === 2 ? district.origin[1] : 0)), [x1, , z1] = c.aabb.max.map((v, i) => v + (i === 0 ? district.origin[0] : i === 2 ? district.origin[1] : 0));
        const edges: [number, number, number, number, number, number][] = [[x0, z0 + .05, x0, z1 - .05, -1, 0], [x1, z0 + .05, x1, z1 - .05, 1, 0], [x0 + .05, z0, x1 - .05, z0, 0, -1], [x0 + .05, z1, x1 - .05, z1, 0, 1]];
        for (const [ax, az, bx, bz, nx, nz] of edges) {
          const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / .1));
          for (let i = 0; i <= n; i++) {
            const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
            const inSeam = d.groundHeight(x + nx * .045, z + nz * .045), beyond = d.groundHeight(x + nx * .12, z + nz * .12);
            if (inSeam < top - .05 && Math.abs(beyond - top) <= .01) seams.push(`${id} ${c.id} (${(x + nx * .045).toFixed(2)}, ${(z + nz * .045).toFixed(2)}) top ${top.toFixed(2)} seam ${inSeam.toFixed(2)}`);
          }
        }
      }
    } finally { w.dispose(); }
  }
  expect(seams.slice(0, 20), `${seams.length} seam samples`).toEqual([]);
}, 900_000);

// --- PO 10-13 L4 "collision": no placed prop cuts into a solid, L1-L9, every tier (backlog in placement-solids.baseline.json).
test('placement vs solids: no placed prop cuts into another solid, L1-L9, every tier (new offenders only)', () => {
  const moving = (p: Placement) => /^(prop|kit|decay|haz)\./.test(p.assetId) && !/^prop\.(tree|street-tree|bush|garden-bush|hedge|flower|grass|privacy-fence|picket-fence)/.test(p.assetId);
  const baseline = new Set<string>((JSON.parse(readFileSync('tests/nightly/placement-solids.baseline.json', 'utf8')) as { pairs: string[] }).pairs);
  const found: string[] = [];
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']) {
    const c = compositions[level]; if (!c) continue;
    const base = c.districts.map(d => loadLayout(`${d.id}.layout.json`));
    const layouts = level === 'L2' ? levelTwoLayouts(base) : level === 'L3' ? levelThreeLayouts(base) : level === 'L4' ? levelFourLayouts(base) : level === 'L5' ? levelFiveLayouts(base) : base;
    for (const layout of layouts) for (const tier of [0, 1, 2, 3, 4, 5, 6] as const)
      for (const o of solidOverlaps(layout, tier, p => moving(p) || level === 'L4' && p.assetId.startsWith('veh.'))) found.push(`${level} ${layout.district}: ${o.placement} (${o.assetId}) x ${o.collider}`);
  }
  const unique = [...new Set(found)].sort();
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/placement-offenders.json', JSON.stringify({ count: unique.length, pairs: unique }, null, 1));
  expect(unique.filter(p => !baseline.has(p))).toEqual([]);
}, 600_000);
