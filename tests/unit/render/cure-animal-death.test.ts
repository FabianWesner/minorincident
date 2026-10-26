import { stripGlbTextures } from '../../../tools/assets/stripGlbTextures';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Mesh, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../../src/assets/manifest.json';
import { sampleClip } from '../../../src/render/characters/clips';
import { disposeCharacter } from '../../../src/render/characters/rig';

for (const id of ['inf.dog', 'inf.lion', 'inf.gorilla', 'inf.elephant', 'inf.zebra', 'inf.flamingo']) test(`T-E32-23-fall-${id} @E32-AC23 shared death rolls the whole animal rig and rests on the ground`, async () => {
  const def = manifest.find(d => d.id === id)!;
  const bytes = readFileSync(def.glb);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(bytes), '');
  try {
    const body = scene.getObjectByName('body'), hip = scene.getObjectByName('hip')!;
    const root = !body || body.parent?.name === 'torso' ? hip : body;
    const before = new Vector3(0, 1, 0).applyQuaternion(root.quaternion);
    sampleClip(scene, body ? 'animal-death' : 'death-back', 1);
    const after = new Vector3(0, 1, 0).applyQuaternion(root.quaternion);
    expect(Math.abs(before.dot(after))).toBeLessThan(.05);
    // Whole rig descendants share the rolled ancestor, so legs do not remain in their living stance.
    expect(root.getObjectByName('legFL') ?? root.getObjectByName('wingL') ?? root.getObjectByName('legL')).toBeDefined();
    scene.updateMatrixWorld(true);
    const bounds = new Box3();
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      for (let parent = node as import('three').Object3D | null; parent; parent = parent.parent) if (!parent.visible || parent.name.startsWith('stump_')) return;
      if (node.userData.crowdEye) return;
      if (node instanceof SkinnedMesh) { node.skeleton.update(); node.computeBoundingBox(); bounds.union(node.boundingBox!.clone().applyMatrix4(node.matrixWorld)); }
      else { node.geometry.computeBoundingBox(); bounds.union(node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld)); }
    });
    expect(bounds.min.y).toBeCloseTo(.015, 2);
  } finally { disposeCharacter(scene); }
});
