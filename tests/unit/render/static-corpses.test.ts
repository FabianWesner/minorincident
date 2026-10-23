import { BufferAttribute, BufferGeometry, Color, Frustum, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshLambertNodeMaterial, OrthographicCamera, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vec3 } from 'three/tsl';
import { expect, test, vi } from 'vitest';
// @ts-expect-error Three's internal module has no declaration
import RenderObjects from 'three/src/renderers/common/RenderObjects.js';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { installPaletteVariantCache } from '../../../src/render/Renderer';
import { packCrowdParts } from '../../../src/assets/crowd';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { createInfectedPlaceholder } from '../../../src/render/characters/infectedPlaceholder';
import { crowdVertexLayout, frozenToneNames, resolveCrowdAppearance } from '../../../src/render/characters/CrowdAppearance';
import { crowdAppearance, hairTones, infectedSkinTones, trouserTones, shirtTones } from '../../../src/data/crowdAppearance';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { RoutineProps } from '../../../src/render/npc/RoutineProps';

test('frozen palette constants match the live palette exactly and survive page swap-removal within 16 vertex attributes', () => {
  const scene = new Scene(), lighting = new Lighting(scene), materials = new Materials(lighting), material = materials.shaded(vec3(1));
  material.userData.frozenCrowd = true;
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), records = new Map<number, EntitySnapshot>();
  try {
    for (const id of [7, 8]) {
      const e = { id, corpse: true } as EntitySnapshot; records.set(id, e);
      pool.place(e, 'runner', baked.geometry, material, baked.clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
    }
    records.delete(7); pool.begin(id => records.get(id));
    const page = pool.children[0] as InstancedMesh, look = crowdAppearance(8);
    const expected = [hairTones[look.hair], infectedSkinTones[look.skin], trouserTones[look.trousers], shirtTones[crowdAppearance(8 + 503).shirt]];
    expect(crowdVertexLayout(page.geometry)).toEqual({ buffers: 8, locations: 16, webgpu: true, webgl2: true });
    for (const [i, name] of frozenToneNames.entries()) {
      const attribute = page.geometry.getAttribute(name), values = new Color(expected[i]).toArray().map(Math.fround);
      expect([attribute.getX(0), attribute.getY(0), attribute.getZ(0)]).toEqual(values);
    }
  } finally { pool.dispose(); baked.geometry.dispose(); material.dispose(); materials.dispose(); lighting.dispose(); }
});

test('Q-124 settled bodies change detail after approach and retreat without losing pose, identity or appearance', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const far = baked.geometry.clone(), near = baked.geometry.clone(); far.userData = { crowdLod: 'lod2' }; near.userData = { crowdLod: 'lod1' };
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const e = { id: 7, corpse: true, transform: { x: 0, y: .7, z: 0, yaw: .4 } } as EntitySnapshot;
  const instance = new Matrix4().makeRotationY(.4).setPosition(0, 0, 0), tint = new Color('#3070b0');
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  const detail = { source: near, material, clip: baked.clip, frame };
  pool.place(e, 'runner', far, material, baked.clip, frame, instance, tint, [.2, .3, .4], '7', [], undefined, detail);
  const update = (x: number) => pool.updateDetail({ x, z: 0 });
  try {
    update(12); expect(pool.snapshot().figures[0].lod).toBe('lod2');
    const revision = pool.revision;
    update(7.9); expect(pool.snapshot().figures[0]).toMatchObject({ id: 7, lod: 'lod1' });
    update(9); expect(pool.snapshot().figures[0].lod).toBe('lod1');
    update(10.1); expect(pool.snapshot().figures[0].lod).toBe('lod2');
    expect(pool.revision).toBe(revision); expect(pool.snapshot().instances).toBe(1);
    expect(pool.drawn()).toEqual([{ id: 7, x: 0, y: 0, z: 0 }]);
    for (const child of pool.children as InstancedMesh[]) if (child.count) {
      const actual = new Matrix4(); child.getMatrixAt(0, actual);
      expect(actual.elements).toEqual(instance.elements.map(Math.fround));
      const colors = child.geometry.getAttribute('_variant'); expect(colors.getX(0) % 2).toBeCloseTo(tint.r);
      expect(child.geometry.getAttribute('_overlay').getZ(0)).toBeCloseTo(.4);
    }
    e.hidden = true; pool.begin(() => e); update(0); expect(pool.snapshot().instances).toBe(0);
  } finally { pool.dispose(); far.dispose(); near.dispose(); baked.geometry.dispose(); material.dispose(); }
});

test('dropped accessories grow beyond their initial instance capacity @E07', () => {
  const props = new RoutineProps(); props.begin();
  for (let i = 0; i < 260; i++) props.dropped('coffee', { x: i, y: 0, z: 0, yaw: 0 });
  props.finish();
  expect(props.children.find(mesh => (mesh as InstancedMesh).count === 260)).toBeDefined(); props.dispose();
});

test('static corpse pages grow beyond the old population cap and survive camera movement @E07', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const records = new Map<number, EntitySnapshot>();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  for (let id = 1; id <= 260; id++) {
    const e = { id, corpse: true } as EntitySnapshot; records.set(id, e);
    pool.place(e, 'runner', baked.geometry, material, baked.clip, frame, new Matrix4().makeTranslation(id * .01, 0, 0), new Color('white'), [0, 0, 0]);
  }
  expect(pool.snapshot()).toMatchObject({ instances: 260, draws: 3 });
  pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(260);
  for (const child of pool.children) {
    const mesh = child as InstancedMesh; expect(mesh.frustumCulled).toBe(true);
    const incremental = mesh.boundingSphere!.clone(); mesh.computeBoundingSphere();
    expect(incremental.center.distanceTo(mesh.boundingSphere!.center)).toBeLessThan(1e-10);
    expect(incremental.radius).toBeCloseTo(mesh.boundingSphere!.radius, 10);
    const local = mesh.geometry.boundingSphere!, matrix = new Matrix4();
    for (let index = 0; index < mesh.count; index++) {
      mesh.getMatrixAt(index, matrix);
      const center = new Vector3().copy(local.center).applyMatrix4(matrix);
      expect(mesh.boundingSphere!.center.distanceTo(center) + local.radius).toBeLessThanOrEqual(mesh.boundingSphere!.radius + 1e-5);
    }
  }
  // A body absent from the records (deleted, or hidden by a corpse budget) leaves alone; its page keeps the rest in place.
  records.delete(1); pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(259);
  records.get(2)!.hidden = true; pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(258);
  expect(pool.snapshot().figures.some(f => f.id === 1 || f.id === 2)).toBe(false);
  // The moved last instance keeps its matrix (the page swap-removes).
  const first = pool.children[0] as InstancedMesh, moved = new Matrix4(); first.getMatrixAt(0, moved);
  expect(new Vector3().setFromMatrixPosition(moved).x).toBeCloseTo(1.28, 5);
  // Restore (a record replaced by another object) rebuilds; the next sync repopulates its saved bodies.
  records.set(3, { id: 3, corpse: true } as EntitySnapshot); pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(0);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('distant corpse pages cull independently while every body persists @E07', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  for (const [index, x] of [0, 1, 100, -100].entries()) {
    pool.place({ id: index + 1, corpse: true } as EntitySnapshot, 'runner', baked.geometry, material, baked.clip, frame, new Matrix4().makeTranslation(x, 0, 0), new Color('white'), [0, 0, 0]);
  }
  const camera = new OrthographicCamera(-10, 10, 10, -10, .1, 100);
  camera.position.set(0, 20, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const visible = pool.children.filter(mesh => frustum.intersectsObject(mesh));
  expect(visible.reduce((count, mesh) => count + (mesh as InstancedMesh).count, 0)).toBe(2);
  expect(pool.snapshot().instances).toBe(4);
  const pages = pool.children as InstancedMesh[];
  expect(pages[1].material).toBe(pages[0].material);
  expect(pages[1].geometry.getAttribute('position')).toBe(pages[0].geometry.getAttribute('position'));
  expect(pages[1].geometry.getAttribute('_variant')).not.toBe(pages[0].geometry.getAttribute('_variant'));
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('L6 prewarmed corpse pages stay empty until a real body joins @E24', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  pool.prepare('runner', baked.geometry, material, baked.clip, frame);
  const page = pool.children[0] as InstancedMesh, geometry = page.geometry, frozen = page.material;
  expect(pool.snapshot()).toMatchObject({ instances: 0, draws: 0, figures: [] });
  pool.prepare('runner', baked.geometry, material, baked.clip, frame);
  expect(pool.children).toHaveLength(1);
  const e = { id: 7, corpse: true } as EntitySnapshot;
  pool.place(e, 'runner', baked.geometry, material, baked.clip, frame, new Matrix4(), new Color('white'), [0, 0, 0]);
  expect(page.geometry).toBe(geometry); expect(page.material).toBe(frozen);
  expect(pool.snapshot()).toMatchObject({ instances: 1, draws: 1 });
  pool.begin(id => id === 7 ? e : undefined);
  expect(pool.snapshot().instances).toBe(1);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('PO33 @E24 headwear reuses the prewarmed body pose and keeps identical drawn geometry',()=>{
  const body=new BufferGeometry();body.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));body.setAttribute('normal',new BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));body.setAttribute('color',new BufferAttribute(new Float32Array(9).fill(.5),3));body.setAttribute('_parts',new BufferAttribute(new Float32Array([0,1,0,0,0,1,0,0,0,1,0,0]),4));body.setIndex([0,1,2]);
  const piece=body.clone();piece.translate(0,1,0);const combined=mergeGeometries([body,piece])!;combined.userData.corpseBody=body;combined.userData.corpseAccessory=piece;
  const pool=new StaticCorpses(),reference=new StaticCorpses(),material=new MeshLambertNodeMaterial(),clip={parts:['head'],frames:1,duration:1,matrices:new Matrix4().makeTranslation(2,0,0).elements};
  const e={id:8,corpse:true,archetype:'infected.runner'} as EntitySnapshot,look={...resolveCrowdAppearance(e),accessory:'acc.hat',hidesHair:true};
  pool.prepare('runner',body,material,clip,0,true);const bodyPosed=vi.spyOn(body,'getAttribute'),piecePosed=vi.spyOn(piece,'getAttribute');
  try{pool.place(e,'runner',combined,material,clip,0,new Matrix4(),new Color('white'),[0,0,0],'8',[],look);expect(bodyPosed.mock.calls.filter(([name])=>name==='position')).toHaveLength(0);expect(piecePosed.mock.calls.filter(([name])=>name==='position').length).toBeGreaterThan(0);}finally{bodyPosed.mockRestore();piecePosed.mockRestore();}
  const plain=combined.clone();plain.userData={};reference.place(e,'runner',plain,material,clip,0,new Matrix4(),new Color('white'),[0,0,0],'8',[],look);
  const actual=(pool.children.at(-1) as InstancedMesh).geometry,expected=(reference.children[0] as InstancedMesh).geometry;
  for(const name of ['position','normal','color','_parts'])expect(actual.getAttribute(name).array).toEqual(expected.getAttribute(name).array);
  expect(actual.index!.array).toEqual(expected.index!.array);reference.dispose();pool.dispose();plain.dispose();combined.dispose();body.dispose();piece.dispose();material.dispose();
});

test('l4-collapse-2: gore masks and death frames share one frozen material (no new shader per dismemberment combination) @E22', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  const masks = [[], ['head'], ['armL', 'foreArmL', 'handL'], ['legR', 'shinR', 'footR', 'head']];
  for (const [i, hidden] of masks.entries()) pool.place({ id: i + 1, corpse: true } as EntitySnapshot, `runner:${i}`, baked.geometry, material, baked.clip, frame - (i % 2), new Matrix4(), new Color('white'), [0, 0, 0], String(i + 1), hidden);
  const pages = pool.children as InstancedMesh[];
  expect(pages).toHaveLength(4); expect(new Set(pages.map(p => p.material)).size).toBe(1); expect(new Set(pages.map(p => p.geometry.getAttribute('position'))).size).toBe(4);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('opposing crowd rotations keep full size during clip fades @E07', () => {
  const first = new Matrix4(), second = new Matrix4().makeRotationY(Math.PI);
  const palette = new CrowdPosePalette({ parts: ['root'], frames: 2, duration: 1, matrices: [...first.elements, ...second.elements] }, 1, .2);
  palette.sample(1, 'idle', 0, 0); palette.sample(1, 'turn', 1, .1);
  const [outgoing, weight] = palette.sample(1, 'turn', 1, .2);
  const row = palette.correct(1, 1, outgoing, weight, () => {});
  const pose = new Matrix4().fromArray(palette.pose(row, outgoing, 1));
  expect(pose.determinant()).toBeCloseTo(1);
  palette.texture.dispose();
});

test('static bodies preserve flock instances and removed body parts @E07', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial(), e = { id: 9 } as EntitySnapshot;
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  for (let bird = 0; bird < 20; bird++) pool.place(e, 'flock', baked.geometry, material, baked.clip, frame, new Matrix4(), new Color('white'), [0, 0, 0], `9/${bird}`, ['head']);
  pool.begin(id => id === 9 ? e : undefined);
  expect(pool.snapshot().instances).toBe(20);
  expect(new Set(pool.snapshot().figures.map(f => f.instanceKey)).size).toBe(20);
  const parts = (pool.children[0] as InstancedMesh).geometry.getAttribute('_parts');
  for (let i = 0; i < parts.count; i++) expect(parts.getX(i)).not.toBe(baked.clip.parts.indexOf('head'));
  // Gore settings invalidate frozen geometry without changing body identities.
  pool.reset();
  for (let bird = 0; bird < 20; bird++) pool.place(e, 'flock', baked.geometry, material, baked.clip, frame, new Matrix4(), new Color('white'), [0, 0, 0], `9/${bird}`);
  expect(pool.snapshot().instances).toBe(20);
  const restored = (pool.children[0] as InstancedMesh).geometry.getAttribute('_parts');
  expect(Array.from({ length: restored.count }, (_, i) => restored.getX(i))).toContain(baked.clip.parts.indexOf('head'));
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('palette corpse pages share shader keys while tint updates target each page own GPU attributes', () => {
  const scene = new Scene(), lighting = new Lighting(scene), materials = new Materials(lighting), source = materials.shaded(vec3(1));
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  for (const [i, x] of [0, 100].entries()) pool.place({ id: i + 1, corpse: true } as EntitySnapshot, 'runner', baked.geometry, source, baked.clip, frame, new Matrix4().makeTranslation(x, 0, 0), new Color(i ? '#e03020' : '#3070b0'), [0, 0, 0]);
  const [a, b] = pool.children as InstancedMesh[];
  expect(a.material).toBe(b.material); expect(a.userData.staticInstanceAttributes).toBe(true);
  const tintA = a.geometry.getAttribute('_variant') as InstancedBufferAttribute, tintB = b.geometry.getAttribute('_variant') as InstancedBufferAttribute;
  expect(tintA).not.toBe(tintB); expect(tintA.version).toBeGreaterThan(0); expect(tintB.version).toBeGreaterThan(0);
  expect(tintA.getX(0) % 2).toBeCloseTo(new Color('#3070b0').r); expect(tintB.getX(0) % 2).toBeCloseTo(new Color('#e03020').r);
  const Manager = RenderObjects as unknown as new (...args: unknown[]) => { get(...args: unknown[]): { getCacheKey(): number }; dispose(): void };
  const objects = new Manager({ backend: {}, contextNode: { id: 1, version: 0 }, _currentSourceMaterial: null }, { getCacheKey: () => 0, delete: vi.fn() }, {}, { delete: vi.fn() }, { deleteForRender: vi.fn() }, {});
  installPaletteVariantCache(objects);
  const camera = new PerspectiveCamera(), lights = {}, context = { id: 1 };
  const get = (mesh: InstancedMesh) => objects.get(mesh, mesh.material, scene, camera, lights, context, null).getCacheKey();
  expect(get(a)).toBe(get(b)); expect(a.count).toBe(1); expect(b.count).toBe(1);
  objects.dispose(); pool.dispose(); baked.geometry.dispose(); source.dispose(); materials.dispose(); lighting.dispose();
});

test('covered hair in triangle soup removes complete triangles instead of shifting the remaining faces @E07 @E18', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const source = baked.geometry.index ? baked.geometry.toNonIndexed() : baked.geometry.clone();
  const parts = source.getAttribute('_parts');
  // One triangle has mixed material tags; every other triangle remains visible.
  for (let i = 0; i < parts.count; i++) { parts.setY(i, 0); parts.setW(i, 0); }
  parts.setY(0, -2);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const e = { id: 27, archetype: 'infected.runner', infected: { variant: 'inf.common-worker' } } as unknown as EntitySnapshot;
  const look = { ...resolveCrowdAppearance(e), slot: 1, hidesHair: true, accessory: 'acc.hat-beanie' };
  try {
    pool.place(e, 'runner', source, material, baked.clip, 0, new Matrix4(), new Color('white'), [0, 0, 0], String(e.id), [], look);
    const geometry = (pool.children[0] as InstancedMesh).geometry;
    expect(geometry.index).toBeNull();
    expect(geometry.getAttribute('position').count).toBe(source.getAttribute('position').count - 3);
    expect(geometry.getAttribute('position').count % 3).toBe(0);
  } finally { pool.dispose(); material.dispose(); source.dispose(); baked.geometry.dispose(); }
});

test('frozen membership revisions change only when an animated caller must rebuild its actor list', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const e = { id: 1, corpse: true, transform: { x: 0, y: .7, z: 0, yaw: 0 } } as EntitySnapshot;
  try {
    const initial = pool.revision;
    pool.place(e, 'runner', baked.geometry, material, baked.clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
    expect(pool.revision).toBeGreaterThan(initial);
    const placed = pool.revision;
    pool.begin(() => e); pool.begin(() => e);
    expect(pool.revision).toBe(placed);
    e.corpseThrown = true; e.transform.x = 5;
    pool.begin(() => e);
    expect(pool.drawn()[0].x).toBe(5); expect(pool.revision).toBe(placed);
    e.hidden = true; pool.begin(() => e);
    expect(pool.revision).toBeGreaterThan(placed); expect(pool.snapshot().instances).toBe(0);
    const dropped = pool.revision; pool.reset(); expect(pool.revision).toBeGreaterThan(dropped);
  } finally { pool.dispose(); material.dispose(); baked.geometry.dispose(); }
});


test('@E18 frozen corpses retain xyz normals after backend vec4 padding', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const source = baked.geometry.getAttribute('normal'), padded = new Float32Array(source.count * 4);
  for (let i = 0; i < source.count; i++) { padded[i * 4] = source.getX(i); padded[i * 4 + 1] = source.getY(i); padded[i * 4 + 2] = source.getZ(i); }
  baked.geometry.setAttribute('normal', new BufferAttribute(padded, 4));
  const expected = new Float32Array(source.count * 3), matrix = new Matrix4(), point = new Vector3(), parts = baked.geometry.getAttribute('_parts');
  for (let i = 0; i < source.count; i++) {
    matrix.fromArray(baked.clip.matrices, parts.getX(i) * 16);
    point.set(source.getX(i), source.getY(i), source.getZ(i)).transformDirection(matrix).toArray(expected, i * 3);
  }
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  try {
    pool.place({ id: 1 } as EntitySnapshot, 'runner', baked.geometry, material, baked.clip, 0, new Matrix4(), new Color('white'), [0, 0, 0]);
    const geometry = (pool.children[0] as InstancedMesh).geometry, normal = geometry.getAttribute('normal');
    expect(normal.itemSize).toBe(3); expect(normal.count).toBe(geometry.getAttribute('position').count);
    expect(normal.array).toEqual(expected);
  } finally { pool.dispose(); baked.geometry.dispose(); material.dispose(); }
});

test('T-E29-19-frozen @E29-AC19 @E18 model pools share one frozen graph and release it after the last owner', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), source = materials.shaded(vec3(1));
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pools = [new StaticCorpses(), new StaticCorpses()];
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  pools[0].prepare('first', baked.geometry, source, baked.clip, frame);
  pools[1].prepare('second', baked.geometry, source, baked.clip, frame);
  const [a, b] = pools.map(pool => pool.children[0] as InstancedMesh);
  expect(a.material).toBe(b.material); expect(a.geometry).not.toBe(b.geometry);
  expect(a.geometry.getAttribute('_variant')).not.toBe(b.geometry.getAttribute('_variant'));
  const disposed = vi.fn(); (a.material as MeshLambertNodeMaterial).addEventListener('dispose', disposed);
  pools[0].dispose(); expect(disposed).not.toHaveBeenCalled();
  const e = { id: 33, corpse: true } as EntitySnapshot;
  pools[1].place(e, 'second', baked.geometry, source, baked.clip, frame, new Matrix4().makeTranslation(4, 0, 0), new Color('white'), [0, 0, 0]);
  expect(pools[1].snapshot().instances).toBe(1);
  pools[1].dispose(); expect(disposed).toHaveBeenCalledTimes(1);
  baked.geometry.dispose(); source.dispose(); materials.dispose(); lighting.dispose();
});

test('plain fallback corpse materials keep independent value snapshots across pools', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const source = new MeshLambertNodeMaterial({ color: '#a03020' }), pools = [new StaticCorpses(), new StaticCorpses()];
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  pools[0].prepare('first', baked.geometry, source, baked.clip, frame);
  source.color.set('#2050b0'); pools[1].prepare('second', baked.geometry, source, baked.clip, frame);
  const [a, b] = pools.map(pool => (pool.children[0] as InstancedMesh).material as MeshLambertNodeMaterial);
  expect(a).not.toBe(b); expect(a.color.getHexString()).toBe('a03020'); expect(b.color.getHexString()).toBe('2050b0');
  pools.forEach(pool => pool.dispose()); baked.geometry.dispose(); source.dispose();
});

test('@E27-AC15 moving corpse pages update bounds once and settled float32 poses stop uploading', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const records = new Map<number, EntitySnapshot>();
  for (const id of [1, 2]) {
    const e = { id, corpse: true, corpseThrown: true, transform: { x: id, y: .7, z: 0, yaw: 0 } } as EntitySnapshot;
    records.set(id, e); pool.place(e, 'runner', baked.geometry, material, baked.clip, 0, new Matrix4().makeTranslation(id, 0, 0), new Color('white'), [0, 0, 0]);
  }
  const page = pool.children[0] as InstancedMesh, bounds = vi.spyOn(page, 'computeBoundingSphere');
  try {
    for (const e of records.values()) Object.assign(e.transform, { x: e.id + .123456789, y: 1.23456789, z: .987654321 });
    pool.begin(id => records.get(id)); expect(bounds).toHaveBeenCalledTimes(1);
    const version = page.instanceMatrix.version;
    pool.begin(id => records.get(id));
    expect(bounds).toHaveBeenCalledTimes(1); expect(page.instanceMatrix.version).toBe(version);
    for (const p of pool.drawn()) expect(p.x).toBe(Math.fround(records.get(p.id)!.transform.x));
  } finally { pool.dispose(); material.dispose(); baked.geometry.dispose(); }
});
