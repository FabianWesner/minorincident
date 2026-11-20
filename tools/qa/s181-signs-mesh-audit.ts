/** Inspect generated sign vertices against their supporting building's authored LOD meshes. */
import { readFileSync } from 'node:fs';
import { DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };
import type { Game } from '../../src/Game';
import { stripGlbTextures } from '../assets/stripGlbTextures';
import { SceneSession, stopServer } from '../scenelab/session';

const level = process.argv[2] ?? 'L10';
const session = new SceneSession({ tier: 'high', backend: 'webgl2' });
let rows: { district: string; id: string; asset: string; vertices: number[][]; position: [number, number, number]; yaw: number; scale: [number, number, number]; neighbors: { id: string; assetId: string; position: [number, number, number]; yaw: number; scale: [number, number, number] }[] }[];
try {
  await session.open();
  rows = await session.page.evaluate(async levelId => {
    const a = window.__SS__!; await a.loadLevel(levelId, { seed: 1 }); a.pause(); await a.screenshotReady();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    const districts = (game.view as unknown as { districts: { parts: { lodBatches: { id: string; origin: number[]; refs: { position: { distanceToSquared(v: unknown): number; clone(): { fromArray(a: number[]): unknown } }; scale: { toArray(): [number, number, number] }; rotation: { y: number } }[] }[]; signBatches: { origin: number[]; district: string; ids: string[]; supports: { asset: string }[]; geometry: { attributes: { position: { getX(i: number): number; getY(i: number): number; getZ(i: number): number } } } }[] } } }).districts;
    return districts.parts.signBatches.flatMap(batch => batch.ids.map((id, i) => {
      const d = game.world.districts!.districts.find(district => district.id === batch.district)!;
      const p = d.layout.placements.find(placement => placement.id === id)!;
      const ref = districts.parts.lodBatches.filter(entry => entry.id === p.assetId && entry.origin[0] === batch.origin[0] && entry.origin[1] === batch.origin[1]).flatMap(entry => entry.refs).find(candidate => candidate.position.distanceToSquared(candidate.position.clone().fromArray(p.position)) < .0001);
      const attr = batch.geometry.attributes.position;
      const vertices = Array.from({ length: 4 }, (_, v) => [attr.getX(i * 4 + v), attr.getY(i * 4 + v), attr.getZ(i * 4 + v)]);
      const min = [0,1,2].map(axis => Math.min(...vertices.map(vertex => vertex[axis])) - .01), max = [0,1,2].map(axis => Math.max(...vertices.map(vertex => vertex[axis])) + .01);
      const neighbors = d.layout.placements.filter(other => other.id !== id && other.visualAabb && [0,1,2].every(axis => other.visualAabb.min[axis] <= max[axis] && other.visualAabb.max[axis] >= min[axis])).map(({ id: otherId, assetId, position, yaw, scale }) => ({ id: otherId, assetId, position, yaw, scale }));
      return { district: batch.district, id, asset: batch.supports[i].asset, vertices, position: p.position, yaw: ref?.rotation.y ?? p.yaw, scale: ref?.scale.toArray() ?? p.scale, neighbors };
    }));
  }, level);
} finally { await session.close(); stopServer(); }

function signIntersections(model: import('three').Object3D, verticesOfSign: number[][]): { intersections: number; points: number[][] } {
  const [a,b,,d] = verticesOfSign.map(v => new Vector3().fromArray(v));
  const u = b.clone().sub(a), v = d.clone().sub(a), normal = u.clone().cross(v).normalize();
  const uv = (p: Vector3) => { const delta = p.clone().sub(a); return [delta.dot(u) / u.lengthSq(), delta.dot(v) / v.lengthSq()]; };
  const crosses = (p: number[], q: number[]) => {
      let lo = 0, hi = 1;
      for (let axis = 0; axis < 2; axis++) {
        const step = q[axis] - p[axis];
        if (Math.abs(step) < 1e-9) { if (p[axis] < 0 || p[axis] > 1) return false; continue; }
        const r = -p[axis] / step, s = (1 - p[axis]) / step;
        lo = Math.max(lo, Math.min(r,s)); hi = Math.min(hi, Math.max(r,s));
      }
      return lo <= hi;
    };
  let intersections = 0; const points: number[][] = [];
  model.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position'), index = object.geometry.getIndex();
      const count = index?.count ?? positions.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const vertices = [0,1,2].map(j => new Vector3().fromBufferAttribute(positions, index ? index.getX(i+j) : i+j).applyMatrix4(object.matrixWorld));
        const distances = vertices.map(point => point.clone().sub(a).dot(normal));
        if (distances.every(value => value > 0) || distances.every(value => value < 0)) continue;
        const hits: Vector3[] = [];
        for (const [j,k] of [[0,1],[1,2],[2,0]]) {
          const x = distances[j], y = distances[k];
          if (x * y <= 0 && Math.abs(x-y) > 1e-9) hits.push(vertices[j].clone().lerp(vertices[k], x / (x-y)));
        }
        if (hits.length >= 2 && crosses(uv(hits[0]), uv(hits[1]))) { intersections++; points.push(uv(hits[0])); }
      }
    });
  return { intersections, points };
}
for (const row of rows) {
  for (const neighbor of row.neighbors) {
    const asset = manifest.find(a => a.id === neighbor.assetId);
    if (!asset?.glb) { console.error(JSON.stringify({ district: row.district, id: row.id, neighbor: neighbor.id, error: 'missing GLB' })); continue; }
    const model = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(asset.glb)), '')).scene;
    model.position.fromArray(neighbor.position); model.rotation.y = neighbor.yaw; model.scale.fromArray(neighbor.scale); model.updateMatrixWorld(true);
    const { intersections, points } = signIntersections(model, row.vertices);
    console.error(JSON.stringify({ district: row.district, id: row.id, neighbor: neighbor.id, asset: neighbor.assetId, lod: 'lod0', intersections, points }));
  }
  const def = manifest.find(asset => asset.id === row.asset)!;
  for (const [lod, path] of [['lod0', def.glb], ['lod1', def.lods?.lod1], ['lod2', def.lods?.lod2]] as const) {
    if (!path) continue;
    const model = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(path)), '')).scene;
    model.traverse(object => { if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.side = DoubleSide; });
    model.position.fromArray(row.position); model.rotation.y = row.yaw; model.scale.fromArray(row.scale); model.updateMatrixWorld(true);
    const [a,b,c,d] = row.vertices.map(v => new Vector3().fromArray(v));
    const normal = new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a)).normalize();
    let ahead = 0, supported = 0, unsupported = 0, maxAhead = 0; const offsets: number[] = [];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 5; y++) {
      const u = (x + .5) / 7, v = (y + .5) / 5;
      const point = a.clone().lerp(b,u).lerp(d.clone().lerp(c,u),v);
      const hit = new Raycaster(point.clone().addScaledVector(normal, 2), normal.clone().negate(), 0, 4).intersectObject(model, true)[0];
      if (!hit) { unsupported++; continue; }
      const offset = 2 - hit.distance; offsets.push(offset);
      if (offset > .01) { ahead++; maxAhead = Math.max(maxAhead, offset); }
      else if (offset >= -.08) supported++;
      else unsupported++;
    }
    const { intersections: crossing, points: crossingPoints } = signIntersections(model, row.vertices);
    console.log(JSON.stringify({ district: row.district, id: row.id, asset: row.asset, lod, crossing, crossingPoints, ahead, maxAhead: +maxAhead.toFixed(3), supported, unsupported, minOffset: offsets.length ? +Math.min(...offsets).toFixed(3) : null, maxOffset: offsets.length ? +Math.max(...offsets).toFixed(3) : null }));
  }
}
