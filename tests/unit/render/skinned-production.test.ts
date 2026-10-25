import { readFileSync, statSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, SkinnedMesh, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import manifest from '../../../src/assets/manifest.json';
import { stripGlbTextures } from '../helpers/stripGlbTextures';
import { bakeInfected, civilianClips, framesPerClip } from '../../../src/render/characters/bakeInfected';
import { crowdLimbParts, packCrowdParts } from '../../../src/assets/crowdParts';
import { compactCrowdGeometry } from '../../../src/render/characters/compactCrowdGeometry';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { PickBodies } from '../../../src/render/characters/PickBodies';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { AssetRegistry } from '../../../src/assets/registry';
import { crowdSurfaceBindings } from '../../../src/render/characters/crowdTexture';
import { sampleClip } from '../../../src/render/characters/clips';

async function baked(id: string) {
  const def = manifest.find(d => d.id === id)!;
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(def.glb)), '');
  scene.traverse(node => { if (node instanceof Mesh && !Array.isArray(node.material) && node.material.name === 'tex_baseColor') (node.material as import('three').MeshStandardMaterial).map = new Texture(); });
  const result = bakeInfected(scene, def.animatedNodes, false, civilianClips, undefined, !id.startsWith('npc.'));
  packCrowdParts(result.geometry);
  if (!id.startsWith('npc.')) compactCrowdGeometry(result.geometry);
  return result;
}

test('converted assets load each requested LOD without hidden wound transforms causing a fallback', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), requests: string[] = [];
  const registry = new AssetRegistry(event => { throw Error(JSON.stringify(event)); }, { load: async url => {
    requests.push(url); return (await loader.parseAsync(stripGlbTextures(readFileSync(`public${url}`)), '')).scene;
  } });
  try {
    for (const def of manifest.filter(d => 'crowdSkin' in d && d.crowdSkin)) for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
      requests.length = 0;
      const model = await registry.loadAsset(def.id, lod), expected = lod === 'lod0' ? def.glb : def.lods![lod];
      expect(model.userData.placeholder, `${def.id}/${lod}`).not.toBe(true);
      expect(expected).toBeDefined(); expect(requests, `${def.id}/${lod}`).toEqual(['/' + expected!.replace(/^public\//, '')]);
    }
  } finally { await registry.dispose(); }
}, 120000);

for (const id of ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'inf.common-worker', 'inf.dog', 'inf.zebra']) test(`${id}: all civilian clips retain finite weighted bodies and exact posed picking bounds`, async () => {
  const { geometry, clip } = await baked(id), positions = geometry.getAttribute('position'), tags = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin');
  expect(clip.frames).toBe(civilianClips.length * framesPerClip); expect(clip.binds).toBeDefined(); expect(skin.count).toBe(positions.count);
  expect(clip.matrices.every(Number.isFinite)).toBe(true);
  const picker = new PickBodies(), palette = new CrowdPosePalette(clip, 1), instance = new Matrix4().makeRotationY(.63).setPosition(3, .4, -2), projection = new Matrix4().makeRotationX(-.7);
  const inverse = new Matrix4(), matrix = new Matrix4(), source = new Vector3(), transformed = new Vector3(), sum = new Vector3();
  for (const { c, cutMask } of [...civilianClips.map((_, c) => ({ c, cutMask: 0 })), ...[1, 2, 4, 8, 16, 31].map(cutMask => ({ c: 0, cutMask }))]) {
    const frame = c * framesPerClip + 13, expected = new Box3(), projected = new Box3();
    let vertices = 0;
    for (let i = 0; i < positions.count; i++) {
      if (tags.getW(i) >= 1024 || tags.getZ(i) > 1.5 || (Math.floor(skin.getW(i)) & cutMask)) continue;
      const packed = skin.getX(i), weights = [1 - skin.getY(i) - skin.getZ(i) - (skin.getW(i) % 1), skin.getY(i), skin.getZ(i), (skin.getW(i) % 1)];
      const joints = [tags.getX(i), packed % 32, Math.floor(packed / 32) % 32, Math.floor(packed / 1024)];
      source.fromBufferAttribute(positions, i); sum.set(0, 0, 0);
      for (let j = 0; j < 4; j++) if (weights[j] > 0) {
        inverse.fromArray(clip.binds!, joints[j] * 16); matrix.fromArray(clip.matrices, (frame * clip.parts.length + joints[j]) * 16);
        sum.addScaledVector(transformed.copy(source).applyMatrix4(inverse).applyMatrix4(matrix), weights[j]);
      }
      sum.applyMatrix4(instance); expected.expandByPoint(sum); projected.expandByPoint(sum.applyMatrix4(projection)); vertices++;
    }
    expect(vertices).toBeGreaterThan(cutMask ? 20 : 100); expect(expected.isEmpty(), civilianClips[c]).toBe(false);
    picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry, cutMask);
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
    expect(caps, part).toBeGreaterThan(0); expect((result.getIndex()?.count ?? result.getAttribute('position').count), part).toBeGreaterThan(100);
    expect(Array.from(result.getAttribute('position').array).every(Number.isFinite)).toBe(true);
  }
  corpses.dispose(); material.dispose(); geometry.dispose();
});

test('production indexed skin batches retain a constant, correct severance mask on each triangle', async () => {
  for (const id of ['inf.common-worker', 'inf.nurse', 'inf.dog', 'inf.zebra']) {
    const { geometry, clip } = await baked(id), index = geometry.getIndex()!, tags = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin');
    const groups = crowdLimbParts(clip.parts.includes('legFL'));
    for (let t = 0; t < index.count; t += 3) {
      const vertices = [0, 1, 2].map(k => index.getX(t + k)); if (vertices.some(i => tags.getW(i) >= 1024)) continue;
      let mask = 0;
      for (const i of vertices) groups.forEach((names, bit) => { if (names.includes(clip.parts[tags.getX(i)])) mask |= 1 << bit; });
      for (const i of vertices) expect(Math.floor(skin.getW(i)), `${id} triangle ${t / 3}`).toBe(mask);
    }
    geometry.dispose();
  }
});

test('L1 proof sources and additional unseen builds publish validated compressed skins within every standalone byte limit', () => {
  for (const id of ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-b', 'inf.nurse', 'inf.dog']) {
    const receipt = JSON.parse(readFileSync(`docs/reports/skinned-prod/builds/${id}/build.json`, 'utf8'));
    expect(receipt.manualSteps).toEqual([]); expect(receipt.receipts).toHaveLength(3);
    expect(Object.keys(receipt.preparedBakes)).toHaveLength(id.startsWith('npc.') ? 6 : 3);
    expect(JSON.parse(readFileSync(`docs/reports/skinned-prod/builds/${id}/validation.json`, 'utf8')).flatMap((r: { errors: string[] }) => r.errors)).toEqual([]);
    for (const row of receipt.receipts) for (const tier of row.tiers) expect(statSync(tier.path).size).toBeLessThanOrEqual([600000, 250000, 150000][row.lod]);
  }
});

test('exact skin support retains flat parts and falls back to all vertices across a perspective pole', () => {
  const points = [[-2, -.3, 0], [-1, -1, 0], [1, -2, 0], [2, -.4, 0], [2, 1, 0], [.3, 2, 0], [-1.5, 1, 0], [.2, -.1, 0]];
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute('_parts', new Float32BufferAttribute(points.flatMap(() => [0, 0, 0, 0]), 4));
  geometry.setAttribute('_skin', new Float32BufferAttribute(points.flatMap(() => [0, 0, 0, 0]), 4));
  const clip = { parts: ['root'], frames: 1, duration: 1, matrices: new Float32Array(new Matrix4().elements), binds: new Float32Array(new Matrix4().elements) };
  const palette = new CrowdPosePalette(clip, 1), picker = new PickBodies(), projection = new Matrix4(); projection.elements[7] = 1; projection.elements[15] = .13;
  picker.begin(); picker.add(1, new Matrix4(), palette, 0, 0, 1, geometry);
  const expected = new Box3(), position = geometry.getAttribute('position'), point = new Vector3();
  for (let i = 0; i < position.count; i++) expected.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(projection));
  const actual = picker.bounds(1, new Box3(), projection)!;
  expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-6); expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-6);
  expect(picker.top(1, projection)).toBeCloseTo(expected.max.y, 6);
  palette.texture.dispose(); geometry.dispose();
});

for (const id of ['inf.common-worker', 'inf.nurse', 'npc.civilian-man-b', 'inf.dog', 'amb.zebra']) test(`${id}: wound rims follow the actual body skin through idle, running and death`, async () => {
  const def = manifest.find(d => d.id === id)!;
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(def.sourceGlb!)), '');
  const body = scene.getObjectByName('skin_body') as SkinnedMesh, point = new Vector3(), target = new Vector3();
  for (const [clip, time] of [['idle', 0], ['run', .25], ['death-back', 1]] as const) {
    sampleClip(scene, clip, time); scene.updateMatrixWorld(true); body.skeleton.update();
    const positions = new Float32Array(body.geometry.getAttribute('position').count * 3);
    for (let i = 0; i < positions.length / 3; i++) body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld).toArray(positions, i * 3);
    for (const part of ['head', 'armL', 'legL']) {
      const cap = scene.getObjectByName(`stump_${part}`) as SkinnedMesh;
      expect(cap.isSkinnedMesh, `${id} ${part}`).toBe(true); cap.skeleton.update();
      for (let i = 0; i < cap.geometry.getAttribute('position').count; i++) {
        cap.getVertexPosition(i, point).applyMatrix4(cap.matrixWorld); let distance = Infinity;
        for (let j = 0; j < positions.length; j += 3) distance = Math.min(distance, point.distanceToSquared(target.fromArray(positions, j)));
        expect(Math.sqrt(distance), `${id} ${clip} ${part} rim ${i}`).toBeLessThan(.0011);
      }
    }
  }
});


test('held skin bounds reuse exact vertices and invalidate when the same mutable pose row is rewritten', () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3));
  geometry.setAttribute('_parts', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0], 4));
  geometry.setAttribute('_skin', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1], 4));
  const clip = { parts: ['root'], frames: 1, duration: 1, matrices: new Float32Array(new Matrix4().elements), binds: new Float32Array(new Matrix4().elements) };
  const palette = new CrowdPosePalette(clip, 1), picker = new PickBodies(), instance = new Matrix4(), bounds = new Box3();
  const blend = palette.sample(1, 'walk', 0, 0);
  const frame = palette.correct(1, 0, blend[0], 1, () => {});
  picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry); picker.bounds(1, bounds);
  const part = vi.spyOn(palette, 'part');
  picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry); picker.bounds(1, bounds);
  expect(part).not.toHaveBeenCalled(); expect(bounds.max.toArray()).toEqual([1, 1, 1]);
  // The row index remains identical while its GPU and CPU contents change.
  expect(palette.correct(1, 0, blend[0], 1, pose => { pose[13] = 2; })).toBe(frame);
  picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry); picker.bounds(1, bounds);
  expect(part).toHaveBeenCalledTimes(1); expect(bounds.max.toArray()).toEqual([1, 3, 1]);
  instance.makeTranslation(2, 0, 0);
  picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry); picker.bounds(1, bounds);
  expect(bounds.max.toArray()).toEqual([3, 3, 1]);
  for (let repeat = 0; repeat < 2; repeat++) {
    picker.begin(); picker.add(1, instance, palette, frame, 0, 1, geometry, 1);
    expect(picker.bounds(1, bounds)).toBeNull();
  }
  geometry.dispose(); palette.texture.dispose();
});


test('every newly opened wound boundary is closed by cap edges at all production LODs', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const def of manifest.filter(d => 'crowdSkin' in d && d.crowdSkin)) for (const lod of [0, 1, 2]) {
    const path = lod === 0 ? def.glb : lod === 1 ? def.lods!.lod1 : def.lods!.lod2;
    const { scene } = await loader.parseAsync(stripGlbTextures(readFileSync(path!)), '');
    const fit = JSON.parse(readFileSync(`docs/reports/skinned-prod/builds/${def.id}/lod${lod}.json`, 'utf8'));
    const tolerance = fit.body === 'rigid parts welded by position' ? 2e-4 : 1e-6;
    const body = (scene.getObjectByName('skin_body') as SkinnedMesh).geometry;
    const joints = (scene.getObjectByName('skin_body') as SkinnedMesh).skeleton.bones.map(b => b.name);
    const positions = body.getAttribute('position'), owners = body.getAttribute('_crowd_part'), indices = body.index!;
    const vertex = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v / tolerance)).join(',');
    const key = (a: string, b: string) => a < b ? `${a}/${b}` : `${b}/${a}`;
    const original = new Map<string, number>();
    for (let t = 0; t < indices.count; t += 3) for (let k = 0; k < 3; k++) { const edge = key(vertex(indices.getX(t + k)), vertex(indices.getX(t + (k + 1) % 3))); original.set(edge, (original.get(edge) ?? 0) + 1); }
    for (const removed of crowdLimbParts(joints.includes('legFL'))) {
      const retained = new Map<string, number>();
      for (let t = 0; t < indices.count; t += 3) {
        const ids = [0, 1, 2].map(k => indices.getX(t + k)); if (ids.some(i => removed.includes(joints[owners.getX(i)]))) continue;
        for (let k = 0; k < 3; k++) { const edge = key(vertex(ids[k]), vertex(ids[(k + 1) % 3])); retained.set(edge, (retained.get(edge) ?? 0) + 1); }
      }
      const cap = (scene.getObjectByName(`stump_${removed[0]}`) as SkinnedMesh).geometry, p = cap.getAttribute('position'), capEdges = new Map<string, number>(), ci = cap.index!;
      const cv = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v / tolerance)).join(',');
      for (let t = 0; t < ci.count; t += 3) for (let k = 0; k < 3; k++) { const edge = key(cv(ci.getX(t + k)), cv(ci.getX(t + (k + 1) % 3))); capEdges.set(edge, (capEdges.get(edge) ?? 0) + 1); }
      // Interior diagonal pairs cancel, including coincident UV seam vertices.
      for (const [edge, count] of retained) if (count === 1 && (original.get(edge) ?? 0) > 1) expect((capEdges.get(edge) ?? 0) % 2, `${def.id} LOD${lod} ${removed[0]} ${edge}`).toBe(1);
    }
  }
}, 120000);


test('frozen pages bind the source atlas when living textured civilians share a shader', async () => {
  const { geometry, clip } = await baked('npc.civilian-man-a'), corpses = new StaticCorpses(), material = new MeshLambertNodeMaterial(), texture = new Texture(), bind = vi.fn();
  crowdSurfaceBindings.set(geometry, { bind, textures: [texture] });
  corpses.prepare('atlas', geometry, material, clip, clip.frames - 1);
  const page = corpses.children[0] as import('three').InstancedMesh;
  (page.onBeforeRender as () => void)();
  expect(bind).toHaveBeenCalledOnce(); expect(page.userData.preRenderTextures).toEqual([texture]);
  corpses.dispose(); material.dispose(); geometry.dispose(); texture.dispose();
});
