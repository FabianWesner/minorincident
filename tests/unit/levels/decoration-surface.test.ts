import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, test } from 'vitest';
import { decorationAllowed, strayDecorations } from '../../../src/levels/districts/decorationSurface';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { stripStrayDecorations } from '../../../src/render/decorationFilter';

/**
 * PO 2026-10-13 "Flowers growing on stone" (L1 D-GROVE garden path): baked daisies were scattered over paths and paving.
 * Decoration surface validator for every district and world tier: after the render filter, every drawn daisy stands on an
 * allowed surface (soil: grass or a planter), and every drawn daisy belongs to a layout decoration (none escapes the rule).
 */
const layouts = readdirSync('public/assets/layouts').filter(f => f.endsWith('.layout.json'));
const daisy = (o: Object3D) => { for (let n: Object3D | null = o; n; n = n.parent) if (n.name === 'daisy' || n.name.startsWith('daisy_')) return true; return false; };
for (const file of layouts) test(`@E19 ${file.replace('.layout.json', '')}: drawn decorations stand only on soil`, async () => {
  const layout = JSON.parse(readFileSync(`public/assets/layouts/${file}`, 'utf8')) as DistrictLayout;
  const decorations = layout.decorations ?? [];
  if (!decorations.length) return;
  const stray = strayDecorations(layout).length;
  for (const tier of ['base', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6']) {
    const path = `public/assets/layouts/${file.replace('.layout.json', '')}.${tier}.glb`;
    if (!existsSync(path)) continue;
    const bytes = readFileSync(path);
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const removed = stripStrayDecorations(scene, layout);
    if (tier === 'base') expect(removed, 'every stray decoration is drawn and removed').toBe(stray);
    const bad: string[] = [], a = new Vector3();
    scene.updateMatrixWorld(true);
    scene.traverse(node => {
      if (!(node instanceof Mesh) || !daisy(node)) return;
      const p = node.geometry.getAttribute('position'), index = node.geometry.index!;
      for (let t = 0; t < index.count; t += 3) {
        a.set(0, 0, 0); for (let k = 0; k < 3; k++) a.add(new Vector3().fromBufferAttribute(p, index.getX(t + k)).applyMatrix4(node.matrixWorld)); a.divideScalar(3);
        let best = -1, distance = .3;
        decorations.forEach((d, i) => { const e = Math.hypot(d.position[0] - a.x, d.position[2] - a.z); if (e < distance) { distance = e; best = i; } });
        if (best < 0) bad.push(`orphan daisy at (${a.x.toFixed(2)}, ${a.z.toFixed(2)})`);
        else if (!decorationAllowed(layout, decorations[best])) bad.push(`daisy on ${decorations[best].position.map(v => v.toFixed(2)).join(',')}`);
      }
    });
    expect([...new Set(bad)].slice(0, 10), `${file} ${tier}`).toEqual([]);
  }
}, 120_000);
