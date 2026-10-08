import { readFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { bakeInfected, civilianClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { CrowdLocomotion } from '../../../src/render/characters/CrowdLocomotion';
import { unplantedClips } from '../../../src/debug/scenelab/motion';

// QA sweep: "Infected feet sink 2-6 cm below the floor in the lurch and attack poses (crowd pose palette)". The baked
// palette is what every far figure draws and what near footwork blends in from, so standing and gait frames must keep
// the heel and toe (CrowdFigureProbe sole points) on or above the floor.
test.each(['inf.common-worker.lod1', 'inf.bbq-dad.lod1', 'inf.brute.lod1', 'inf.cashier.lod1', 'npc.civilian-man-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'])('baked crowd standing and gait frames keep both soles on the floor: %s @E07', async (asset) => {
  const bytes = readFileSync(`public/assets/models/${asset}.glb`);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const baked = bakeInfected(scene, [], false, civilianClips), sole = new CrowdLocomotion(scene, baked.clip).sole;
  const parts = ['footL', 'footR'].map(n => baked.clip.parts.indexOf(n)), m = new Matrix4(), p = new Vector3();
  const worst: Record<string, number> = {};
  civilianClips.forEach((clip, c) => {
    if (unplantedClips.test(clip)) return;
    for (let f = 0; f < framesPerClip; f++) for (const part of parts) for (const x of [-.05, .085]) {
      m.fromArray(baked.clip.matrices, ((c * framesPerClip + f) * baked.clip.parts.length + part) * 16);
      worst[clip] = Math.min(worst[clip] ?? Infinity, p.set(x, -sole, 0).applyMatrix4(m).y * 100);
    }
  });
  for (const [clip, cm] of Object.entries(worst)) expect(cm, `${asset} ${clip}`).toBeGreaterThanOrEqual(-1);
  baked.geometry.dispose();
});
