import { test, expect } from 'vitest';
import { BufferAttribute, BoxGeometry, Group, Mesh, Scene } from 'three/webgpu';
import { DistrictAssets } from '../../../src/assets/DistrictAssets';
import { staticBatchMaterial } from '../../../src/assets/staticBatch';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';

test('T-E29-19-memory @E29-AC19 district cache drops unused RGB while preserving palette and figure color graphs', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), assets = new DistrictAssets(materials);
  const remember = (assets as unknown as { remember(root: Group): Group }).remember.bind(assets);
  for (const world of [true, false]) {
    const geometry = new BoxGeometry(), count = geometry.getAttribute('position').count;
    const color = new BufferAttribute(new Float32Array(count * 3), 3), palette = new BufferAttribute(new Float32Array(count), 1);
    geometry.setAttribute('color', color); geometry.setAttribute('_palette', palette);
    const positions = geometry.getAttribute('position'), index = geometry.index;
    const material = staticBatchMaterial(materials, false, true, false, false, false, world);
    const root = new Group(); root.add(new Mesh(geometry, material)); remember(root);
    expect(geometry.hasAttribute('color')).toBe(!world);
    if (!world) expect(geometry.getAttribute('color')).toBe(color);
    expect(geometry.getAttribute('_palette')).toBe(palette);
    expect(geometry.getAttribute('position')).toBe(positions); expect(geometry.index).toBe(index);
    material.dispose();
  }
  assets.dispose(); materials.dispose(); lighting.dispose();
});
