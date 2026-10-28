// Shared render contracts: every crowd figure, corpse and prop in all levels goes through these paths. The compiled-program
// GPU-limit ground truth is tests/e2e/crowd-gpu-limits.spec.ts; these node tests pin the CPU-side layouts and math it relies on.
import { BufferAttribute, BufferGeometry, BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Color, DataTexture, FloatType, Frustum, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute, Matrix4, OrthographicCamera, Quaternion, RGBAFormat, Vector3 } from 'three';
import { MeshLambertNodeMaterial, Scene, type InstancedMesh } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { expect, test, vi } from 'vitest';
import { packCrowdParts } from '../../src/assets/crowd';
import { bakeInfected, framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected';
import { crowdVertexLayout, resolveCrowdAppearance, markCrowdAppearance } from '../../src/render/characters/CrowdAppearance';
import { createSkinnedCrowdFixture } from '../fixtures/skinnedCrowd';
import { packSkin, premultiplyRow, restInverses, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd';
import { StaticCorpses } from '../../src/render/characters/StaticCorpses';
import { Lighting } from '../../src/render/Lighting';
import { corpseLod, crowdLod, pickLod, propLod } from '../../src/render/lodPolicy';
import { Materials } from '../../src/render/Materials';
import { installTextureRanges } from '../../src/render/TextureRanges';
import { uploadFloatTexture, type FloatUploadDevice } from '../../src/render/TextureUpload';
import { weatherMaterialFlags } from '../../src/render/WeatherView';
import { civilianMaterial } from '../../src/render/npc/CivilianMaterial';
import { RoutineProps } from '../../src/render/npc/RoutineProps';
import { crowdGunHolds, longGunHolds } from '../../src/render/characters/GunAim';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { crowdWeaponGeometry, crowdWeaponAssets } from '../../src/render/npc/crowdWeapons';
import { isCrowdVariant, registerCrowdModel } from '../../src/render/crowdModels';
import { installTextureBindingIdentity } from '../../src/render/Renderer';
import { crowdSurfaceBindings } from '../../src/render/characters/crowdTexture';
import { addHighwayRailJoints } from '../../src/assets/highwayRailJoints';
import { InstancedGroup } from '../../src/render/InstancedGroup';
import { skinnedBrow } from '../../src/render/characters/headMeasurements';
import { characterNodes } from '../../src/data/survivor';

/** Crowd headroom below the portable hard limits (16 attributes, 8 WebGPU vertex buffers). */
const CROWD = { attributes: 14, buffers: 7 };
const deathFrame = () => infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;

test('streamed highway joints reuse the static placement and shadow graph across LODs', () => {
  const lighting = new Lighting(new Scene()), shading = new Materials(lighting), material = shading.fromColor('joint', new Color('#999996'), 0, true);
  const root = new Group(), geometries = addHighwayRailJoints(root, material);
  const a = new InstancedGroup(root, [new Object3D()]), b = new InstancedGroup(root, [new Object3D()]);
  try {
    expect(a.children).toHaveLength(2);
    a.children.forEach((child, index) => {
      const mesh = child as InstancedMesh, other = b.children[index] as InstancedMesh;
      expect(mesh.userData.staticInstanceAttributes).toBe(true);
      expect(mesh.isInstancedMesh).toBe(false);
      expect(mesh.material).toBe(other.material);
      expect(mesh.geometry.getAttribute('_placement0')).toBeDefined();
      expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
      expect(mesh.geometry.index!.count).toBe(36);
    });
  } finally { a.dispose(); b.dispose(); for (const geometry of geometries) geometry.dispose(); shading.dispose(); lighting.dispose(); }
});

test('a held cane reaches the floor across rig scales without moving its fitted grip', () => {
  const props = new RoutineProps(), matrix = new Matrix4();
  for (const scale of [.8, 1, 1.3]) for (const floor of [0, .13]) {
    const hand = new Matrix4().makeScale(scale, scale, scale).setPosition(.2, floor + .8 * scale, .3);
    props.begin(); props.held('cane', hand, 7, undefined, .07, false, floor);
    const mesh = props.children.find(child => (child as InstancedMesh).count === 1) as InstancedMesh;
    mesh.getMatrixAt(0, matrix);
    expect(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix).min.y).toBeCloseTo(floor, 5);
    const grip = hand.clone().multiply(new Matrix4().makeTranslation(.07 - .025, 0, 0));
    for (const axis of [12, 13, 14]) expect(matrix.elements[axis]).toBeCloseTo(grip.elements[axis], 6);
  }
  props.dispose();
});

test('authored aftermath and skinned infected headwear survives variation and accepts explicit accessories', () => {
  for (let id = 1; id <= 32; id++) {
    const entity = { id, archetype: 'civilian.cashier', appearance: { entityId: id, asset: 'npc.person.aftermath', accessories: [], tint: '#888888' } } as unknown as EntitySnapshot;
    expect(resolveCrowdAppearance(entity, ['acc.test']).accessory, `authored headwear, entity ${id}`).toBeNull();
    entity.appearance!.accessories = ['acc.test'];
    expect(resolveCrowdAppearance(entity, ['acc.test']).accessory).toBe('acc.test');
    for (const model of ['inf.common-worker', 'inf.jogger', 'inf.cashier', 'inf.delivery-driver', 'inf.suburban-mom', 'inf.bbq-dad', 'inf.bathrobe-neighbor']) {
      const native = { id, archetype: 'infected.runner', infected: { variant: model } } as unknown as EntitySnapshot;
      expect(resolveCrowdAppearance(native, ['acc.test']).accessory, model).toBeNull();
      native.appearance = { entityId: id, asset: model, accessories: ['acc.test'], tint: '#888888' } as EntitySnapshot['appearance'];
      expect(resolveCrowdAppearance(native, ['acc.test']).accessory, model).toBe('acc.test');
    }
  }
  const coarse = new BufferGeometry(), head = characterNodes.indexOf('head');
  coarse.setAttribute('position', new BufferAttribute(new Float32Array([-.15, 0, -.2, .15, .3, .2, .2, .24, 0, .2, .05, 0]), 3));
  coarse.setAttribute('_parts', new BufferAttribute(new Float32Array([head, -1, 0, 0, head, -1, 0, 0, head, 0, 2, 0, head, 0, 0, 0]), 4));
  coarse.userData.crowdBinds = characterNodes.flatMap(() => new Matrix4().toArray());
  const brow = skinnedBrow(coarse)!;
  expect(brow.width).toBeCloseTo(.4); expect(brow.depth).toBeCloseTo(.3);
  coarse.userData.crowdAtlas = true;
  markCrowdAppearance(coarse);
  expect(coarse.getAttribute('_parts').getY(3)).toBe(0); // authored lower-face/beard surface is never hair
  expect(coarse.getAttribute('_parts').getW(3)).toBe(0);
  coarse.dispose();
});

test('crowd registration retains converted textured variants with their own model identity', () => {
  const native = new Set(['inf.runner']), aliases = new Map<string, string>();
  const variant = { id: 'inf.outfit', status: 'integrated', category: 'infected' } as const;
  expect(isCrowdVariant(variant, native)).toBe(false);
  expect(isCrowdVariant({ ...variant, textureMode: 'baseColor' }, native)).toBe(false);
  expect(isCrowdVariant({ ...variant, textureMode: 'baseColor', crowdSkin: true }, native)).toBe(true);
  expect(isCrowdVariant({ ...variant, id: 'inf.runner', crowdSkin: true }, native)).toBe(false);
  expect(registerCrowdModel(aliases, { id: variant.id, asset: variant.id })).toBe(variant.id);
  expect(aliases.get(variant.id)).toBe(variant.id);
});

test('crowd weapons preserve the authored grip, rotate +X barrel into +Z, and own their geometry', () => {
  const root = new Group(), grip = new Object3D(), muzzle = new Object3D();
  grip.name = 'grip'; grip.position.set(-.2, .1, .03); muzzle.name = 'muzzle'; muzzle.position.set(.7, .1, .03);
  const source = new BoxGeometry(.9, .03, .03), mesh = new Mesh(source, new MeshBasicMaterial({ color: '#804020' }));
  root.add(mesh, grip, muzzle); const original = source.getAttribute('position').array.slice();
  const result = crowdWeaponGeometry(root, .65);
  expect(result.muzzle.x).toBeCloseTo(0); expect(result.muzzle.y).toBeCloseTo(0); expect(result.muzzle.z).toBeCloseTo(.585);
  expect(Object.keys(result.geometry.attributes)).toEqual(['position', 'normal', 'color']);
  expect(result.geometry.groups).toHaveLength(0); expect(source.getAttribute('position').array).toEqual(original);
  for (const [id, hold] of Object.entries(crowdGunHolds)) expect(hold.support).toEqual([-longGunHolds[crowdWeaponAssets[id as keyof typeof crowdWeaponAssets]].support[2], longGunHolds[crowdWeaponAssets[id as keyof typeof crowdWeaponAssets]].support[1], longGunHolds[crowdWeaponAssets[id as keyof typeof crowdWeaponAssets]].support[0]]);
  result.geometry.dispose(); source.dispose(); mesh.material.dispose();
});

test('GPU limits: crowd layouts bind matrix columns or instanceMatrix (never both); frozen corpse pages stay within buffer headroom', () => {
  const geometry = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['_parts', 4], ['_dogCream', 3]] as const) geometry.setAttribute(name, new BufferAttribute(new Float32Array(size * 3), size));
  const instance = new InstancedInterleavedBuffer(new Float32Array(8), 8, 1);
  geometry.setAttribute('_state', new InterleavedBufferAttribute(instance, 4, 0)); geometry.setAttribute('_variant', new InterleavedBufferAttribute(instance, 4, 4));
  const columns = new InstancedInterleavedBuffer(new Float32Array(16), 16, 1);
  for (let c = 0; c < 4; c++) geometry.setAttribute(`_crowd${c}`, new InterleavedBufferAttribute(columns, 4, c * 4));
  const layout = crowdVertexLayout(geometry, new InstancedBufferAttribute(new Float32Array(16), 16));
  expect(layout).toEqual({ buffers: 7, locations: 11, webgpu: true, webgl2: true });

  const baked = bakeInfected(createSkinnedCrowdFixture(), [], false); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  pool.prepare('plain', baked.geometry, material, baked.clip, deathFrame());
  for (const id of [1, 2]) pool.place({ id } as EntitySnapshot, 'plain', baked.geometry, material, baked.clip, deathFrame(), new Matrix4(), new Color(1, 1, 1), [0, 0, 0]);
  const page = pool.children[0] as InstancedMesh, pageLayout = crowdVertexLayout(page.geometry, page.instanceMatrix);
  const surface = ['position', 'normal', 'color', '_parts'].map(name => page.geometry.getAttribute(name) as InterleavedBufferAttribute);
  expect(surface.every(a => a.isInterleavedBufferAttribute && a.data === surface[0].data)).toBe(true);
  expect(pageLayout.buffers + 1).toBeLessThanOrEqual(CROWD.buffers); // + placement colour
  expect(pageLayout.locations + 1).toBeLessThanOrEqual(CROWD.attributes);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('textured corpse draws bind their surface and upload placements added after warm-up', () => {
  const baked = bakeInfected(createSkinnedCrowdFixture()); packCrowdParts(baked.geometry);
  const lighting = new Lighting(new Scene()), shading = new Materials(lighting), pool = new StaticCorpses();
  const material = shading.shaded(vec3(.5)), bind = vi.fn();
  crowdSurfaceBindings.set(baked.geometry, { bind, textures: [] });
  try {
    pool.prepare('runner', baked.geometry, material, baked.clip, deathFrame());
    const page = pool.children[0] as InstancedMesh;
    const upload = () => (page.onBeforeRender as () => void).call(page);
    upload(); bind.mockClear();
    pool.place({ id: 1 } as EntitySnapshot, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4().makeTranslation(3, 0, 5), new Color('white'), [0, 0, 0]);
    upload();
    const placement = page.geometry.getAttribute('_placement0') as InterleavedBufferAttribute;
    expect(placement.data.version).toBe(page.instanceMatrix.version);
    expect(placement.data.array[12]).toBe(3); expect(placement.data.array[14]).toBe(5);
    expect(bind).toHaveBeenCalledOnce();
  } finally { pool.dispose(); baked.geometry.dispose(); shading.dispose(); lighting.dispose(); }
});

test('skinned crowd: four-influence packing, joint·bind⁻¹ atlas rows, and corpse freezing with the shader blend', () => {
  const pose = (x: number, angle: number) => new Matrix4().compose(new Vector3(x, 1, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle), new Vector3(1, 1, 1));
  const { dominant, skin } = packSkin([3, 7, 12, 0], [.2, .5, .3, 0], 1);
  expect(dominant[0]).toBe(7);
  expect(skin[0] % 32).toBe(12); expect(Math.floor(skin[0] / 32) % 32).toBe(3);
  expect(1 - skin[1] - skin[2] - skin[3]).toBeCloseTo(.5);
  const rest = [pose(0, 0), pose(.5, .3)], frame = [pose(.1, .2), pose(.7, -.4)];
  const binds = restInverses(rest.map(m => ({ matrixWorld: m })));
  const rows = new Float32Array(32); frame.forEach((m, i) => m.toArray(rows, i * 16));
  const gpu = new Float32Array(32); premultiplyRow(rows, gpu, binds, 0, 2);
  const local = new Vector3(.1, .2, .3), world = local.clone().applyMatrix4(rest[1]);
  expect(world.applyMatrix4(new Matrix4().fromArray(gpu, 16)).distanceTo(local.applyMatrix4(frame[1]))).toBeLessThan(1e-5);
  const clip = { parts: ['a', 'b'], frames: 1, duration: 1, matrices: rows, binds };
  const out = skinnedVertexMatrix(clip, 0, new BufferAttribute(new Float32Array([0, 0, 0, 0]), 4), new BufferAttribute(new Float32Array([1, .25, 0, 0]), 4), 0, new Float32Array(16));
  const a = new Matrix4().multiplyMatrices(frame[0], rest[0].clone().invert()), b = new Matrix4().multiplyMatrices(frame[1], rest[1].clone().invert());
  expect([...out].map(v => +v.toFixed(5))).toEqual(a.toArray().map((v, i) => +(v * .75 + b.elements[i] * .25).toFixed(5)));
  // A frozen accessory uses one head influence in bind space, including nonidentity binds.
  const triangle = (part: number, points: Vector3[]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points.flatMap(p => p.toArray())), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(9).fill(.5), 3));
    geometry.setAttribute('_parts', new BufferAttribute(new Float32Array([part, -4, 0, 0, part, -4, 0, 0, part, -4, 0, 0]), 4));
    geometry.setAttribute('_skin', new BufferAttribute(new Float32Array(12), 4));
    return geometry;
  };
  const localPoints = [new Vector3(0, .1, 0), new Vector3(.2, .1, 0), new Vector3(0, .3, .1)];
  const body = triangle(0, localPoints), accessory = triangle(1, localPoints.map(p => p.clone().applyMatrix4(rest[1])));
  const composite = body.clone(); composite.userData = { corpseBody: body, corpseAccessory: accessory };
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  pool.prepare('attachment', composite, material, clip, 0);
  pool.place({ id: 7 } as EntitySnapshot, 'attachment', composite, material, clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
  const positions = (pool.children[0] as InstancedMesh).geometry.getAttribute('position');
  for (let i = 0; i < 3; i++) expect(new Vector3().fromBufferAttribute(positions, positions.count - 3 + i).distanceTo(localPoints[i].clone().applyMatrix4(frame[1]))).toBeLessThan(1e-5);
  pool.dispose(); material.dispose(); composite.dispose(); body.dispose(); accessory.dispose();
});

test('corpse pages: bodies persist past the old cap, bounds stay conservative, culling restores identity/pose/tint, normals survive vec4 padding', () => {
  const baked = bakeInfected(createSkinnedCrowdFixture()); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial(), records = new Map<number, EntitySnapshot>();
  try {
    for (let id = 1; id <= 260; id++) {
      const e = { id, corpse: true } as EntitySnapshot; records.set(id, e);
      pool.place(e, 'runner', baked.geometry, material, baked.clip, deathFrame(), new Matrix4().makeTranslation(id * .01, 0, 0), new Color('white'), [0, 0, 0]);
    }
    pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(260);
    for (const child of pool.children) {
      const mesh = child as InstancedMesh, local = mesh.geometry.boundingSphere!, matrix = new Matrix4();
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix);
        expect(mesh.boundingSphere!.center.distanceTo(local.center.clone().applyMatrix4(matrix)) + local.radius).toBeLessThanOrEqual(mesh.boundingSphere!.radius + 1e-5);
      }
    }
    records.delete(1); pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(259);
  } finally { pool.dispose(); }

  const culled = new StaticCorpses(), live = new Map<number, EntitySnapshot>();
  const add = (id: number, x: number, tint: string) => { const e = { id, corpse: true, transform: { x, y: .7, z: 0 } } as EntitySnapshot; live.set(id, e); culled.place(e, 'runner', baked.geometry, material, baked.clip, 0, new Matrix4().makeTranslation(x, 0, 0), new Color(tint), [id / 10, 0, 0]); };
  add(2, 9.5, '#3070b0'); add(1, 0, '#e03020');
  const page = culled.children[0] as InstancedMesh, initial = culled.drawn().sort((p, q) => p.id - q.id);
  const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 30), frustum = new Frustum();
  const aim = (x: number) => { camera.position.set(x, 10, 0); camera.lookAt(x, 0, 0); camera.updateMatrixWorld(true); frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); culled.begin(id => live.get(id)); culled.cull?.(frustum); (page.onAfterRender as () => void)(); };
  try {
    aim(0); expect(page.count).toBe(1); expect(culled.snapshot().instances).toBe(2);
    expect(page.geometry.getAttribute('_variant').getX(0) % 2).toBeCloseTo(new Color('#e03020').r);
    aim(9.5); expect(culled.snapshot().figures.filter(f => f.drawn).map(f => f.id)).toEqual([2]);
    expect(page.geometry.getAttribute('_variant').getX(0) % 2).toBeCloseTo(new Color('#3070b0').r);
    expect(culled.drawn().sort((p, q) => p.id - q.id)).toEqual(initial);
  } finally { culled.dispose(); }

  const source = baked.geometry.getAttribute('normal'), padded = new Float32Array(source.count * 4);
  for (let i = 0; i < source.count; i++) { padded[i * 4] = source.getX(i); padded[i * 4 + 1] = source.getY(i); padded[i * 4 + 2] = source.getZ(i); }
  const paddedGeometry = baked.geometry.clone(); paddedGeometry.setAttribute('normal', new BufferAttribute(padded, 4));
  const expected = new Float32Array(source.count * 3), matrix = new Matrix4(), point = new Vector3(), parts = baked.geometry.getAttribute('_parts');
  for (let i = 0; i < source.count; i++) { matrix.fromArray(baked.clip.matrices, parts.getX(i) * 16); point.set(source.getX(i), source.getY(i), source.getZ(i)).transformDirection(matrix).toArray(expected, i * 3); }
  const frozen = new StaticCorpses();
  try {
    frozen.place({ id: 1 } as EntitySnapshot, 'runner', paddedGeometry, material, baked.clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
    const normal = (frozen.children[0] as InstancedMesh).geometry.getAttribute('normal');
    expect(normal.itemSize).toBe(3);
    expect(Float32Array.from({ length: normal.count * 3 }, (_, i) => normal.getComponent(Math.floor(i / 3), i % 3))).toEqual(expected);
  } finally { frozen.dispose(); baked.geometry.dispose(); paddedGeometry.dispose(); material.dispose(); }
});

test('LOD selection: authored distance bands with hysteresis; game-camera-size crowd figures never take the far silhouette', () => {
  expect([0, 7, 9, 25].map(d => pickLod(d))).toEqual(['lod0', 'lod0', 'lod1', 'lod2']);
  expect(pickLod(9, 'lod0')).toBe('lod0'); expect(pickLod(10.5, 'lod0')).toBe('lod1');
  expect(pickLod(7, 'lod1')).toBe('lod1'); expect(pickLod(5.5, 'lod1')).toBe('lod0');
  expect(pickLod(120, 'lod0')).toBe('lod2'); expect(pickLod(4, 'lod2')).toBe('lod0');
  expect(corpseLod(7.9)).toBe('lod1'); expect(corpseLod(9, 'lod1')).toBe('lod1'); expect(corpseLod(10, 'lod1')).toBe('lod2');
  expect(crowdLod(89, 'lod1')).toBe('lod1'); expect(crowdLod(87, 'lod1')).toBe('lod2'); expect(crowdLod(103, 'lod2')).toBe('lod2');
  for (const pixels of [105, 160, 300]) for (const previous of [undefined, 'lod1', 'lod2'] as const) expect(crowdLod(pixels, previous)).toBe('lod1');
  expect(propLod(129)).toBe('lod0'); expect(propLod(111, 'lod0')).toBe('lod1'); expect(propLod(145, 'lod1')).toBe('lod0');
});

test('materials: palette program keys match Three through weather and node changes; uniforms share a render group per material only', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  try {
    const material = materials.get('sidewalk'), reference = MeshLambertNodeMaterial.prototype.customProgramCacheKey;
    const check = () => expect(material.customProgramCacheKey()).toBe(reference.call(material));
    check(); material.fade.value = .3; check();
    material.setWeatherMode(weatherMaterialFlags.fog | weatherMaterialFlags.wet); check();
    material.positionNode = vec3(1, 2, 3); check(); material.positionNode = null; check();
    Object.defineProperty(material, 'extraNode', { value: float(.5), configurable: true }); check();
    const copy = material.frozenCopy(); expect(copy.customProgramCacheKey()).toBe(reference.call(copy)); copy.dispose();
    const first = materials.get('asphalt'), second = materials.get('grass'), group = first.fade.groupNode;
    expect(group.shared).toBe(true); expect(group.updateType).toBe('render');
    for (const node of [first.emissivePower, first.hitFlash, first.figureRim]) expect(node.groupNode).toBe(group);
    expect(second.fade.groupNode).not.toBe(group);
    first.fade.value = .2; expect(second.fade.value).toBe(1);
  } finally { materials.dispose(); lighting.dispose(); }
});

test('texture route: lossless 256-byte-aligned float uploads; cold WebGPU atlases map, warm ones reuse Three, ranges write rows', () => {
  let bytes = new ArrayBuffer(0);
  const buffer = { getMappedRange: () => bytes, unmap: vi.fn(), destroy: vi.fn() };
  const command = {}, encoder = { copyBufferToTexture: vi.fn(), finish: () => command };
  const gpu = { createBuffer: vi.fn(({ size }: { size: number }) => { bytes = new ArrayBuffer(size); return buffer; }), createCommandEncoder: vi.fn(() => encoder), queue: { submit: vi.fn() } };
  const width = 76, backing = Float32Array.from({ length: width * 8 + 4 }, (_, i) => i * .12345), pixels = backing.subarray(4);
  uploadFloatTexture(gpu, {}, pixels, width, 2);
  const stride = Math.ceil(width * 16 / 256) * 256, source = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), mapped = new Uint8Array(bytes);
  for (let row = 0; row < 2; row++) expect(mapped.slice(row * stride, row * stride + width * 16)).toEqual(source.slice(row * width * 16, (row + 1) * width * 16));
  expect(buffer.unmap.mock.invocationCallOrder[0]).toBeLessThan(encoder.copyBufferToTexture.mock.invocationCallOrder[0]);

  gpu.queue.submit.mockClear();
  const original = vi.fn(), write = vi.fn(), data = { texture: {}, glTextureType: 0, glFormat: 0, glType: 0 };
  const backend = { ...gpu, device: { ...gpu, queue: { ...gpu.queue, writeTexture: write } } as FloatUploadDevice, get: () => data, updateTexture: original };
  const texture = new DataTexture(new Float32Array(128), 4, 8, RGBAFormat, FloatType);
  installTextureRanges(backend); backend.updateTexture(texture, {});
  expect(original).not.toHaveBeenCalled(); expect(gpu.queue.submit).toHaveBeenCalledOnce();
  backend.updateTexture(texture, {}); expect(original).toHaveBeenCalledOnce();
  texture.addUpdateRange(96, 32); backend.updateTexture(texture, {}); expect(write).toHaveBeenCalledOnce();
  texture.dispose();
});

test('switching equal-version colour and pose textures refreshes the GPU binding, including cloned render bindings', () => {
  const a = new DataTexture(), b = new DataTexture(); a.needsUpdate = b.needsUpdate = true;
  expect(a.version).toBe(b.version);
  let value = b;
  const binding = { isSampledTexture: true, texture: a, generation: a.version as number | undefined,
    update() { const changed = this.texture !== value; this.texture = value; return changed; } };
  const manager = { _createBindings: vi.fn() };
  installTextureBindingIdentity(manager); manager._createBindings([{ bindings: [binding] }]);
  expect(binding.update()).toBe(true); expect(binding.generation).toBeUndefined();
  binding.generation = b.version;
  expect(binding.update()).toBe(false); expect(binding.generation).toBe(b.version);
  const clone = { ...binding }; manager._createBindings([{ bindings: [clone] }]);
  value = a;
  expect(clone.update()).toBe(true); expect(clone.generation).toBeUndefined();
  expect(binding.texture).toBe(b); expect(binding.generation).toBe(b.version);
  a.dispose(); b.dispose();
});

// Soldiers and armed civilians in L3/L4 share the courier's real gun contracts.
test('crowd long guns use asset grip/muzzle sockets and the courier support-hand offsets', async () => {
  const shading = new Materials(new Lighting(new Scene())), pose = new DataTexture(), a = new DataTexture(), b = new DataTexture();
  const one = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: a });
  const same = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: a });
  const other = civilianMaterial(shading, false, pose, { bindRow: 0, atlas: b });
  expect(one.material).toBe(same.material); expect(one.material).toBe(other.material);
  one.release(); same.release(); other.release(); shading.dispose();
  const props = new RoutineProps();
  const loadAsset = vi.fn(async (id: string) => {
    const model = new Group(); model.name = id; const material = new MeshLambertNodeMaterial({ color: '#789abc' });
    model.add(new Mesh(new BoxGeometry(.8, .1, .05), material));
    const grip = new Object3D(); grip.name = 'grip'; grip.position.set(-.2, -.1, 0); model.add(grip);
    const muzzle = new Object3D(); muzzle.name = 'muzzle'; muzzle.position.set(.4, 0, 0); model.add(muzzle);
    return model;
  });
  await props.init({ loadAsset });
  expect(loadAsset.mock.calls).toHaveLength(5);
  for (const [prop, asset] of [['rifle', 'wpn.assault-rifle'], ['hmg', 'wpn.machine-gun'], ['hunting-rifle', 'wpn.hunting-rifle'], ['shotgun', 'wpn.shotgun']]) {
    const hold = longGunHolds[asset], crowd = crowdGunHolds[prop];
    expect(crowd.support).toEqual([-hold.support[2], hold.support[1], hold.support[0]]);
    props.begin();
    props.held(prop === 'hmg' ? 'rifle' : prop as 'rifle' | 'hunting-rifle' | 'shotgun', new Matrix4().makeTranslation(2, 3, 4), 7, undefined, .07, prop === 'hmg');
    const muzzle = props.muzzles.get(7)!;
    expect(muzzle.x).toBeCloseTo(2); expect(muzzle.y).toBeCloseTo(3 + .1 * hold.scale); expect(muzzle.z).toBeCloseTo(4 + .6 * hold.scale);
    expect(props.guns[0].geometry.getAttribute('color').getY(0)).toBeGreaterThan(0);
    expect(props.guns[0].geometry.boundingBox!.max.z).toBeCloseTo(.6 * hold.scale);
  }
  props.dispose();
});
