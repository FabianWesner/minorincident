import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Plane, Ray, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { View } from '../../../src/render/View';
import { l7Exit } from '../../../src/levels/L7/layout';

test('@E02-AC03 #67 L7 elevated paving covers the widest launcher view at the Northgate exit', async () => {
  const bytes = readFileSync('public/assets/layouts/D-FAIR.w6.glb');
  const scene = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  const bounds = new Box3().setFromObject(scene);
  for (const [w, h] of [[1600, 900], [390, 844], [844, 390]]) {
    const player = { x: l7Exit.position[0], y: l7Exit.position[1] + .72, z: l7Exit.position[2] };
    const view = new View(); view.resize(w, h); view.reset(player); view.setEquippedWeapon('weapon.rocket-launcher'); view.zoom(100, true); view.update(player, 0);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const point = new Ray(view.camera.position, new Vector3(x, y, .5).unproject(view.camera).sub(view.camera.position).normalize()).intersectPlane(new Plane(new Vector3(0, 1, 0), -3.9), new Vector3())!;
      expect(point.x).toBeGreaterThan(bounds.min.x); expect(point.x).toBeLessThan(bounds.max.x);
      expect(point.z).toBeGreaterThan(bounds.min.z); expect(point.z).toBeLessThan(bounds.max.z);
    }
  }
});
