import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from '../../src/assets/manifest.json';
import { staticCollision } from '../../src/assets/staticCollision';
import type { PhysicsAsset } from '../../src/data/pushableProps';

/** Bake GLB extras at layout build time so Node and browser use identical authored data. */
export function physicsMetadata(): Record<string, PhysicsAsset> {
  const result: Record<string, PhysicsAsset> = {};
  for (const asset of manifest) {
    if (!asset.glb || !existsSync(asset.glb)) continue;
    const bytes = readFileSync(asset.glb);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const nodes = json.nodes as { name?: string; translation?: number[]; extras?: Record<string, unknown> }[];
    const raw = nodes.find(n => n.extras?.ss_physics)?.extras?.ss_physics;
    if (!raw) continue;
    const physics = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const boxes = staticCollision[asset.id]?.boxes ?? [];
    // Older collider extras use Blender XYZ sizes, newer ones game XYZ. Resolve that export
    // convention against delivered geometry; translations are always GLTF Y-up.
    const authored = nodes.filter(n => n.name?.startsWith('col:') && Array.isArray(n.extras?.size)).map(n => {
      const size = n.extras!.size as number[], p = n.translation ?? [0, 0, 0];
      const geometry = boxes.length ? [0, 1, 2].map(a => Math.max(...boxes.map(b => b.max[a])) - Math.min(...boxes.map(b => b.min[a]))) : [asset.dimensions.x, asset.dimensions.y, asset.dimensions.z];
      const score = (s: number[]) => s.reduce((sum, v, a) => sum + Math.abs(Math.log(v / Math.max(.01, geometry[a]))), 0);
      const swapped = [size[0], size[2], size[1]], s = score(swapped) < score(size) ? swapped : size;
      return { min: p.map((v, a) => v - s[a] / 2), max: p.map((v, a) => v + s[a] / 2) };
    });
    result[asset.id] = { ...physics, boxes: authored.length ? authored : boxes, source: asset.glb, hash: createHash('sha256').update(bytes).digest('hex') };
  }
  return result;
}
export function writePhysicsMetadata(): void {
  writeFileSync('src/data/physicsAssets.json', JSON.stringify(physicsMetadata(), null, 2) + '\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writePhysicsMetadata();
