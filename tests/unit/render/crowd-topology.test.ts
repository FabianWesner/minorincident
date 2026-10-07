import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DoubleSide, Matrix4, Vector3, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { AssetMaterials } from '../../../src/assets/materials';

test('common-worker crowd triangles keep one rigid owner and bounded posed edges at every LOD @E07', async () => {
  const metrics = [];
  for (const lod of ['', '.lod1', '.lod2']) {
    const bytes = readFileSync(`public/assets/models/inf.common-worker${lod}.glb`);
    const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    // The repaired tiers are authored closed solids. Reapplying the generated
    // delivery collapse would recreate the torn surfaces found in production.
    if (lod) expect(scene.userData.deliveryLodGenerated, lod).not.toBe(true);
    const sides: Record<string, number> = {}, negative: string[] = []; scene.updateMatrixWorld(true); scene.traverse(n => { if (n instanceof Mesh) { const m = Array.isArray(n.material) ? n.material[0] : n.material; sides[m.name] = m.side; if (n.matrixWorld.determinant() < 0) negative.push(n.name); } });
    const materials = new AssetMaterials(); materials.swap(scene);
    scene.traverse(n => { if (n instanceof Mesh) for (const m of Array.isArray(n.material) ? n.material : [n.material]) expect(m.side, `${lod}:${m.name}`).toBe(sides[m.name]); });
    const baked = bakeInfected(scene), pos = baked.geometry.getAttribute('position'), owners = baked.geometry.getAttribute('_part_index');
    expect(baked.doubleSided, lod).toBe(Object.values(sides).includes(DoubleSide));
    const colors = baked.geometry.getAttribute('color'), emissive = baked.geometry.getAttribute('_emissive');
    for (let i = 0; i < colors.count; i++) if (Math.max(colors.getX(i), colors.getY(i), colors.getZ(i)) < .04) expect(emissive.getX(i), `${lod}: dark hair/cloth`).toBe(0);
    const matrices = baked.clip.parts.map(() => new Matrix4()), points = [new Vector3(), new Vector3(), new Vector3()];
    let maxEdge = 0, maxArea = 0, mixedOwners = 0;
    for (const name of ['idle', 'run', 'shamble', 'death-back'] as const) for (const f of [0, 6, 12, 23]) {
      const frame = infectedClips.indexOf(name) * framesPerClip + f;
      matrices.forEach((matrix, part) => matrix.fromArray(baked.clip.matrices, (frame * matrices.length + part) * 16));
      for (let i = 0; i < pos.count; i += 3) {
        if (owners.getX(i) !== owners.getX(i + 1) || owners.getX(i) !== owners.getX(i + 2)) mixedOwners++;
        points.forEach((point, j) => point.fromBufferAttribute(pos, i + j).applyMatrix4(matrices[owners.getX(i + j)]));
        for (let j = 0; j < 3; j++) maxEdge = Math.max(maxEdge, points[j].distanceTo(points[(j + 1) % 3]));
        maxArea = Math.max(maxArea, new Vector3().subVectors(points[1], points[0]).cross(new Vector3().subVectors(points[2], points[0])).length() / 2);
      }
    }
    metrics.push({ lod: lod || 'lod0', triangles: pos.count / 3, maxEdge, maxArea, mixedOwners, sides, negative });
    baked.geometry.dispose(); materials.dispose();
  }
  mkdirSync('test-results/epics/E07/crowd-feel', { recursive: true }); writeFileSync('test-results/epics/E07/crowd-feel/topology.json', JSON.stringify(metrics, null, 2));
  for (const m of metrics) { expect(m.mixedOwners, m.lod).toBe(0); expect(m.maxEdge, m.lod).toBeLessThan(.9); expect(m.maxArea, m.lod).toBeLessThan(.15); }
});
