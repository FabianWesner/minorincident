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
let rows: { district: string; id: string; asset: string; vertices: number[][]; position: [number, number, number]; yaw: number; scale: [number, number, number] }[];
try {
  await session.open();
  rows = await session.page.evaluate(async levelId => {
    const a = window.__SS__!; await a.loadLevel(levelId, { seed: 1 }); a.pause(); await a.screenshotReady();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    const districts = (game.view as unknown as { districts: { parts: { signBatches: { district: string; ids: string[]; supports: { asset: string }[]; geometry: { attributes: { position: { getX(i: number): number; getY(i: number): number; getZ(i: number): number } } } }[] } } }).districts;
    return districts.parts.signBatches.flatMap(batch => batch.ids.map((id, i) => {
      const d = game.world.districts!.districts.find(district => district.id === batch.district)!;
      const p = d.layout.placements.find(placement => placement.id === id)!;
      const attr = batch.geometry.attributes.position;
      return { district: batch.district, id, asset: batch.supports[i].asset, vertices: Array.from({ length: 4 }, (_, v) => [attr.getX(i * 4 + v), attr.getY(i * 4 + v), attr.getZ(i * 4 + v)]), position: p.position, yaw: p.yaw, scale: p.scale };
    }));
  }, level);
} finally { await session.close(); stopServer(); }
for (const row of rows) {
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
    console.log(JSON.stringify({ district: row.district, id: row.id, asset: row.asset, lod, ahead, maxAhead: +maxAhead.toFixed(3), supported, unsupported, minOffset: offsets.length ? +Math.min(...offsets).toFixed(3) : null, maxOffset: offsets.length ? +Math.max(...offsets).toFixed(3) : null }));
  }
}
