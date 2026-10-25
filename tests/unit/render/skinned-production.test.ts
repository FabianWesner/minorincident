import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Matrix4, Mesh, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import manifest from '../../../src/assets/manifest.json';
import { stripGlbTextures } from '../helpers/stripGlbTextures';
import { bakeInfected, civilianClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { packCrowdParts } from '../../../src/assets/crowdParts';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { PickBodies } from '../../../src/render/characters/PickBodies';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';

async function baked(id: string) {
  const def = manifest.find(d => d.id === id)!;
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(def.glb)), '');
  scene.traverse(node => { if (node instanceof Mesh && !Array.isArray(node.material) && node.material.name === 'tex_baseColor') (node.material as import('three').MeshStandardMaterial).map = new Texture(); });
  const result = bakeInfected(scene, def.animatedNodes, false, civilianClips);
  packCrowdParts(result.geometry); return result;
}

for (const id of ['npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b']) test(`${id}: all civilian clips retain finite weighted bodies and exact posed picking bounds`, async () => {
  const { geometry, clip } = await baked(id), positions = geometry.getAttribute('position'), tags = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin');
  expect(clip.frames).toBe(civilianClips.length * framesPerClip); expect(clip.binds).toBeDefined(); expect(skin.count).toBe(positions.count);
  expect(clip.matrices.every(Number.isFinite)).toBe(true);
  const picker = new PickBodies(), palette = new CrowdPosePalette(clip, 1), instance = new Matrix4().makeRotationY(.63).setPosition(3, .4, -2), projection = new Matrix4().makeRotationX(-.7);
  const inverse = new Matrix4(), matrix = new Matrix4(), source = new Vector3(), transformed = new Vector3(), sum = new Vector3();
  for (let c = 0; c < civilianClips.length; c++) {
    const frame = c * framesPerClip + 13, expected = new Box3(), projected = new Box3();
    let vertices = 0;
    for (let i = 0; i < positions.count; i++) {
      if (tags.getW(i) >= 1024 || tags.getZ(i) > 1.5) continue;
      const packed = skin.getX(i), weights = [1 - skin.getY(i) - skin.getZ(i) - skin.getW(i), skin.getY(i), skin.getZ(i), skin.getW(i)];
      const joints = [tags.getX(i), packed % 32, Math.floor(packed / 32) % 32, Math.floor(packed / 1024)];
      source.fromBufferAttribute(positions, i); sum.set(0, 0, 0);
      for (let j = 0; j < 4; j++) if (weights[j] > 0) {
        inverse.fromArray(clip.binds!, joints[j] * 16); matrix.fromArray(clip.matrices, (frame * clip.parts.length + joints[j]) * 16);
        sum.addScaledVector(transformed.copy(source).applyMatrix4(inverse).applyMatrix4(matrix), weights[j]);
      }
      sum.applyMatrix4(instance); expected.expandByPoint(sum); projected.expandByPoint(sum.applyMatrix4(projection)); vertices++;
    }
    expect(vertices).toBeGreaterThan(100); expect(expected.isEmpty(), civilianClips[c]).toBe(false);
    picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry);
    const actual = picker.bounds(1, new Box3())!;
    expect(actual.min.distanceTo(expected.min), civilianClips[c]).toBeLessThan(1e-5);
    expect(actual.max.distanceTo(expected.max), civilianClips[c]).toBeLessThan(1e-5);
    expect(picker.top(1, projection), civilianClips[c]).toBeCloseTo(projected.max.y, 5);
  }
  palette.texture.dispose(); geometry.dispose();
}, 120000);

test('severed skinned corpses retain only the requested cap and exclude every removed joint and eye disc', async () => {
  const { geometry, clip } = await baked('inf.common-worker'), corpses = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const freeze = corpses as unknown as { frozenPose: (g: typeof geometry, m: typeof material, c: typeof clip, f: number, hidden: string[]) => { geometry: typeof geometry } };
  for (const [part, cap, hidden] of [['armL', 1, ['armL', 'foreArmL', 'handL']], ['legL', 5, ['legL', 'shinL', 'footL']], ['head', 0, ['head']]] as const) {
    const result = freeze.frozenPose(geometry, material, clip, 13, [...hidden]).geometry, parts = result.getAttribute('_parts');
    let caps = 0;
    for (let i = 0; i < parts.count; i++) {
      expect(parts.getZ(i)).toBeLessThanOrEqual(1.5);
      if (parts.getW(i) >= 1024) { expect(parts.getW(i), part).toBe(1024 + cap); caps++; }
      else expect(hidden as readonly string[], part).not.toContain(clip.parts[parts.getX(i)]);
    }
    expect(caps, part).toBeGreaterThan(0); expect(result.getIndex()!.count, part).toBeGreaterThan(100);
    expect(Array.from(result.getAttribute('position').array).every(Number.isFinite)).toBe(true);
  }
  corpses.dispose(); material.dispose(); geometry.dispose();
});

test('three unseen cast builds publish validated compressed skins within every standalone byte limit', () => {
  for (const id of ['npc.civilian-man-b', 'inf.nurse', 'inf.dog']) {
    const receipt = JSON.parse(readFileSync(`docs/reports/skinned-prod/builds/${id}/build.json`, 'utf8'));
    expect(receipt.manualSteps).toEqual([]); expect(receipt.receipts).toHaveLength(3);
    expect(JSON.parse(readFileSync(`docs/reports/skinned-prod/builds/${id}/validation.json`, 'utf8')).flatMap((r: { errors: string[] }) => r.errors)).toEqual([]);
    for (const row of receipt.receipts) for (const tier of row.tiers) expect(statSync(tier.path).size).toBeLessThanOrEqual([600000, 250000, 150000][row.lod]);
  }
});
