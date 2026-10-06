import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertNodeMaterial, Scene } from 'three/webgpu';
import { staticBatch } from '../../../src/assets/staticBatch';
import { Materials } from '../../../src/render/Materials';
import { Lighting } from '../../../src/render/Lighting';
import { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import { Grass } from '../../../src/render/Grass';
import type { DistrictLayout } from '../../../src/levels/districts/types';

const layout = (id: string): DistrictLayout => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
test('@E19 @M1-14 L1 streets retain anchors, narrower lanes and continuous small dressing', () => {
  const res = layout('D-RES'), main = layout('D-MAIN'), shop = layout('D-SHOP');
  expect(res.anchors['player-start'].position).toEqual([-14, 0, -7]);
  expect(main.anchors['diner-door'].position).toEqual([-14, 0, -7.127500000000001]);
  expect(main.anchors['hardware-display'].position).toEqual([14, 0, -7.300000190734863]);
  for (const l of [res, main, shop]) {
    expect(l.roads.edges.every(e => e.laneWidth === 5)).toBe(true);
    expect(l.colliders.filter(c => c.id.startsWith('dressing:')).length).toBeGreaterThan(15);
    for (const x of [-20, -12, 12, 20, 26]) {
      const details = (l.decorations ?? []).filter(p => p.kind === 'flower' && Math.abs(p.position[0] - x) < 6 && Math.abs(p.position[2]) < 7);
      expect(details.length, `${l.district} x=${x} must have curated verge details`).toBeGreaterThanOrEqual(10);
    }
  }
});
test('@E19 @M1-14 production batches share stylized light and mobile grass retains every lawn', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), source = new Group();
  const geometry = new BoxGeometry(), original = new MeshLambertNodeMaterial({ color: '#829948' });
  source.add(new Mesh(geometry, original));
  const batch = staticBatch(source, true, materials);
  expect((batch.children[0] as Mesh).material).toBeInstanceOf(PaletteMaterial);
  const grassMaterial = Grass.material(materials, materials.wind), grass = new Grass(layout('D-RES'), grassMaterial, 1);
  const full = grass.geometry.getAttribute('position').count;
  expect(full / 3).toBeGreaterThan(10_000);
  grass.setQuality(true); const sparse = grass.geometry.drawRange.count;
  expect(sparse / full).toBeGreaterThan(.1); expect(sparse / full).toBeLessThan(.25);
  const positions = grass.geometry.getAttribute('position');
  // Both verges remain populated at low quality; this is not a truncated first lawn.
  let north = 0, south = 0;
  for (let i = 0; i < sparse; i += 3) { if (positions.getZ(i) < -3.8) north++; if (positions.getZ(i) > 3.8) south++; }
  expect(north).toBeGreaterThan(100); expect(south).toBeGreaterThan(100);
  grass.dispose(); batch.traverse(n => { if (n instanceof Mesh) { n.geometry.dispose(); (n.material as PaletteMaterial).dispose(); } });
  geometry.dispose(); original.dispose(); materials.dispose(); lighting.dispose();
});
