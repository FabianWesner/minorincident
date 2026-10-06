import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshLambertNodeMaterial, Vector3 } from 'three/webgpu';
import { crownGeometry, leafClusterSdf } from '../../../src/render/Foliage';
import { staticBatch } from '../../../src/assets/staticBatch';
import { staticCollision } from '../../../src/assets/staticCollision';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';

test('@E19 leaf cards form a round volume at both quality tiers, with finite unit bent normals and a leafy SDF border', () => {
  const geometry = crownGeometry(), positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  expect(positions.count).toBe(320); expect(geometry.index!.count).toBe(480);
  for (const count of [160, 320]) {
    const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i), n = new Vector3().fromBufferAttribute(normals, i);
      min.min(p); max.max(p); expect(n.length()).toBeCloseTo(1, 5); expect(n.dot(p.clone().normalize())).toBeGreaterThan(.5);
    }
    expect(Math.min(...max.sub(min).toArray())).toBeGreaterThan(1.5);
  }
  const sdf = leafClusterSdf(), solid = Array.from({ length: 128 * 128 }, (_, i) => sdf[i * 4] >= 128);
  const coverage = solid.filter(Boolean).length / solid.length;
  expect(coverage).toBeGreaterThan(.2); expect(coverage).toBeLessThan(.65);
  for (let i = 0; i < 128; i++) { expect(solid[i]).toBe(false); expect(solid[127 * 128 + i]).toBe(false); }
  geometry.dispose();
});

test('@E19 foliage asset crown markers survive delivery; trees block only their trunk; hedge collision remains current', async () => {
  const defs = (manifest as AssetDef[]).filter(a => a.foliage), io = await assetIO();
  expect(defs.find(a => a.id === 'prop.tree')!.glb).toBe(defs.find(a => a.id === 'prop.street-tree')!.glb);
  expect(defs.find(a => a.id === 'prop.tree')!.glb).not.toContain('hedge');
  for (const def of defs) {
    const doc = await io.read(def.glb), nodes = doc.getRoot().listNodes();
    expect(nodes.find(n => n.getName() === 'crownProxy')?.getExtras().foliageProxy).toBe(true);
    for (let i = 0; i < def.foliage!.crowns.length; i++) expect(nodes.some(n => n.getName() === `crown:${i}`)).toBe(true);
    expect(staticCollision[def.id].boxes.length).toBeGreaterThan(0);
    if (def.id.includes('tree')) for (const box of staticCollision[def.id].boxes) {
      expect(box.max[0] - box.min[0]).toBeLessThan(.8); expect(box.max[2] - box.min[2]).toBeLessThan(.8);
    }
  }
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-RES.layout.json', 'utf8'));
  expect(layout.placements.filter((p: { assetId: string }) => p.assetId.startsWith('prop.street-tree')).length).toBeGreaterThanOrEqual(12);
});

test('@E19 district batches exclude descendants of exported crown proxies', () => {
  const source = new Group(), proxy = new Group(), geometry = new BoxGeometry(), material = new MeshLambertNodeMaterial();
  proxy.userData.foliageProxy = true; const crown = new Mesh(geometry, material); crown.scale.setScalar(5); proxy.add(crown);
  source.add(proxy, new Mesh(geometry, material)); const batch = staticBatch(source, true);
  const size = new Box3().setFromObject(batch).getSize(new Vector3()); expect(size.toArray()).toEqual([1, 1, 1]);
  batch.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); (node.material as MeshLambertNodeMaterial).dispose(); } });
  geometry.dispose(); material.dispose();
});
