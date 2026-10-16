import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Color, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { balancedCrowdModel, crowdAppearance, regularInfectedModels } from '../../../src/data/crowdAppearance';
import { crowdVertexLayout, markCrowdAppearance, packedAppearance, renderedCrowdLook, crowdVariety } from '../../../src/render/characters/CrowdAppearance';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';
import { packCrowdParts } from '../../../src/assets/crowdParts';
import { decodeCivilianBake } from '../../../src/assets/civilianBakeData';
import manifest from '../../../src/assets/manifest.json';

async function model(id: string, lod: 'lod0' | 'lod1' | 'lod2') {
  const def = manifest.find(d => d.id === id)!;
  const bytes = readFileSync(lod === 'lod0' ? def.glb : def.lods![lod]!);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.userData.assetId = id; return scene;
}

test('crowd appearance: packed float32 choices and shirt colour survive all LODs and checkpoint IDs @E07 @E08', () => {
  const shirt = new Color('#486e69');
  for (const hidesHair of [false, true]) for (let id = 1; id <= 1000; id++) {
    const expected = crowdAppearance(id), packed = new Float32Array(packedAppearance(id, shirt, 12, hidesHair));
    expect(Math.floor(packed[0] / 2) % 8).toBe(expected.hair);
    expect(Math.floor(packed[1] / 2) % 6).toBe(expected.skin);
    expect(Math.floor(packed[2] / 2) % 8).toBe(expected.trousers);
    expect(Math.floor(packed[0] / 16) % 32).toBe(12);
    expect(Math.floor(packed[0] / 512) % 2).toBe(Number(hidesHair));
    for (let c = 0; c < 3; c++) expect(packed[c] % 2).toBeCloseTo(shirt.toArray()[c], 4);
    expect(crowdAppearance(JSON.parse(JSON.stringify({ id })).id)).toEqual(expected);
  }
  const appearances = Array.from({length:20}, (_, i) => crowdAppearance(i+1));
  expect(new Set(appearances.map(a => a.hair)).size).toBe(8);
  expect(new Set(appearances.map(a => JSON.stringify(a))).size).toBe(20);
});

test('crowd model balancing holds locally after clustered waves and deaths, excluding distant figures @E07', () => {
  const neighbours: { model: string; x: number; z: number }[] = [];
  for (let i = 0; i < 200; i++) {
    const at = { x: i % 10, z: Math.floor(i / 10) };
    neighbours.push({ model: balancedCrowdModel(regularInfectedModels, neighbours, at, i), ...at });
  }
  const counts = regularInfectedModels.map(m => neighbours.filter(n => n.model===m).length);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  expect(Math.max(...counts)/200).toBeLessThanOrEqual(.25);
  const distant = neighbours.map(n => ({ ...n, x: n.x+1000 }));
  expect(balancedCrowdModel(regularInfectedModels, distant, { x: 0, z: 0 }, 1)).toBe(balancedCrowdModel(regularInfectedModels, [], {x:0,z:0}, 1));
});

for (const lod of ['lod0','lod1','lod2'] as const) test(`crowd appearance ${lod}: real infected/civilian layouts fit BOTH WebGPU eight buffers and WebGL2 sixteen locations @E18-AC01`, async () => {
  const infected = bakeInfected(await model('inf.common-worker', lod));
  deinterleaveGeometry(infected.geometry);
  const indexed = mergeVertices(infected.geometry); infected.geometry.dispose(); infected.geometry = indexed;
  packCrowdParts(infected.geometry); markCrowdAppearance(infected.geometry);
  const matrix = new InstancedBufferAttribute(new Float32Array(16), 16);
  for (const name of ['_state','_variant']) infected.geometry.setAttribute(name, new InstancedBufferAttribute(new Float32Array(4),4));
  // CrowdView binds the explicit E17 matrix as `_crowd0..3` geometry attributes (one interleaved buffer) and keeps
  // the implicit instanceMatrix as the worst-case mask/id-pass binding. Counting both plus a phantom explicit
  // matrix reported 9 buffers (spec audit 10-16) while the real WebGPU pipeline uses 7.
  const crowd = new InstancedInterleavedBuffer(new Float32Array(16),16,1);
  for (let c=0;c<4;c++) infected.geometry.setAttribute(`_crowd${c}`,new InterleavedBufferAttribute(crowd,4,c*4));
  const layout = crowdVertexLayout(infected.geometry, matrix);
  expect(layout).toEqual({ buffers:8, locations:14, webgpu:true, webgl2:true });
  const rig = await model('npc.civilian-elderly', lod); prepareCivilianRig(rig, 'npc.civilian-elderly');
  const civilian = await prepareCivilianGeometry(rig, 'npc.civilian-elderly', lod==='lod2');
  markCrowdAppearance(civilian.geometry);
  for (const [name,size] of [['_clip_frame',1],['_variant',4],['_overlay',4]] as const) civilian.geometry.setAttribute(name, new InstancedBufferAttribute(new Float32Array(size),size));
  const matrices = new InstancedInterleavedBuffer(new Float32Array(16),16,1);
  for (let c=0;c<4;c++) civilian.geometry.setAttribute(`_crowd${c}`,new InterleavedBufferAttribute(matrices,4,c*4));
  expect(crowdVertexLayout(civilian.geometry)).toEqual({ buffers:5, locations:12, webgpu:true, webgl2:true });
  const look = renderedCrowdLook(1,'npc.civilian-elderly',civilian.geometry,new Color('#3178ac'),null);
  expect(renderedCrowdLook(1,'npc.civilian-elderly',civilian.geometry,new Color('#3178ac'),null)).toBe(look);
  const clone = civilian.geometry.clone(); expect(renderedCrowdLook(1,'npc.civilian-elderly',clone,new Color('#3178ac'),null).key).toBe(look.key); clone.dispose();
  expect(renderedCrowdLook(1,'npc.civilian-elderly',civilian.geometry,new Color('#b95862'),null).key).not.toBe(look.key);
  expect(look.hair).not.toBeNull(); expect(look.skin).not.toBeNull(); expect(look.trousers).not.toBeNull(); expect(look.shirt).not.toBeNull();
  const looks = Array.from({length:20}, (_,i) => renderedCrowdLook(i+1,'npc.civilian-elderly',civilian.geometry,new Color('#3178ac'),null));
  expect(crowdVariety(looks).per20[0].distinct).toBeGreaterThanOrEqual(15);
  expect(crowdVariety(looks).largestSameLookShare).toBeLessThanOrEqual(.25);
  infected.geometry.dispose(); civilian.geometry.dispose();
}, 60000);

test('prebuilt pedestrian bakes receive hair/trousers tags without an extra attribute @E08', async () => {
  const { gunzipSync } = await import('node:zlib');
  const { readdirSync } = await import('node:fs');
  for (const id of ['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly']) {
    const path = readdirSync('public/assets/civilians').find(f => f.startsWith(`${id}.lod1.`))!;
    const bytes = gunzipSync(readFileSync(`public/assets/civilians/${path}`));
    const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
    const names = Object.keys(baked.geometry.attributes); markCrowdAppearance(baked.geometry);
    expect(Object.keys(baked.geometry.attributes)).toEqual(names);
    const look = renderedCrowdLook(1,id,baked.geometry,new Color('#3178ac'),null);
    expect(look.hair, id).not.toBeNull(); expect(look.trousers, id).not.toBeNull();
    if (id === 'npc.civilian-man-b' || id === 'npc.civilian-elderly') {
      const parts = baked.geometry.getAttribute('_parts');
      expect(Array.from({length:parts.count}, (_, i) => parts.getW(i)).some(w => w >= 4), `${id} headwear mask`).toBe(true);
    }
    baked.geometry.dispose();
  }
});

test('head accessories share a rigid instance draw across models and preserve identity at LOD2 @E18-AC01', async () => {
  const { CrowdAccessories } = await import('../../../src/render/characters/CrowdAccessories');
  const { CrowdPosePalette } = await import('../../../src/render/characters/CrowdPosePalette');
  const { Matrix4, Group, Mesh, BoxGeometry, MeshBasicMaterial } = await import('three');
  const { vi } = await import('vitest');
  const { AssetRegistry } = await import('../../../src/assets/registry');
  const load = vi.spyOn(AssetRegistry.prototype,'loadAsset').mockImplementation((id, lod) => {
    if (!id.startsWith('acc.placeholder-')) return model(id, lod === 'lod1' || lod === 'lod2' ? lod : 'lod0');
    const root = new Group(); root.add(new Mesh(new BoxGeometry(.27,.06,.28), new MeshBasicMaterial())); return Promise.resolve(root);
  });
  const accessories = new CrowdAccessories(); await accessories.init(); accessories.begin();
  for (const mesh of accessories.children as import('three').InstancedMesh[]) expect((mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count)/3).toBeLessThanOrEqual(mesh.name.endsWith('lod0') ? 150 : 80);
  const matrices = new Matrix4().makeTranslation(0,1.6,0).toArray();
  const poses = new CrowdPosePalette({ parts:['head'],frames:1,duration:1,matrices },10);
  const actor = { id:1, archetype:'infected.runner', appearance:{asset:'npc.civilian-man-a',accessories:[accessories.ids[0]]} } as unknown as import('../../../src/sim/world/types').EntitySnapshot;
  accessories.place(actor,'lod1',poses,0,[0,1],new Matrix4().makeTranslation(3,0,4));
  accessories.place({...actor,id:2,appearance:{...actor.appearance!,asset:'npc.civilian-woman-a'}},'lod1',poses,0,[0,1],new Matrix4().makeTranslation(5,0,6));
  accessories.place(actor,'lod2',poses,0,[0,1],new Matrix4()); accessories.finish();
  const drawn = accessories.snapshot().filter(b=>b.instances);
  expect(drawn).toHaveLength(1); expect(drawn[0].draws).toBe(1); expect(drawn[0].instances).toBe(3);
  expect(drawn[0].triangles/3).toBeLessThanOrEqual(80);
  expect(drawn[0].layout).toEqual({buffers:5,locations:8,webgpu:true,webgl2:true});
  const mesh = accessories.children.find(n=>n.name===drawn[0].id) as import('three').InstancedMesh;
  const result = new Matrix4(); mesh.getMatrixAt(0,result); expect(result.elements.slice(12,15)).toEqual([3,expect.closeTo(1.6),4]);
  expect(accessories.hidesHair(actor, 'lod1')).toBe(true);
  expect(accessories.slot({...actor,civilian:{adult:false,model:'npc.civilian-kid'},appearance:{...actor.appearance!,asset:'npc.civilian-kid'}} as unknown as import('../../../src/sim/world/types').EntitySnapshot)).toBeGreaterThan(0); expect(accessories.hidesHair(actor, 'lod2')).toBe(true);
  expect(crowdVertexLayout(mesh.geometry, mesh.instanceMatrix).buffers + 1).toBeLessThanOrEqual(8);
  poses.texture.dispose(); accessories.dispose(); load.mockRestore();
});

test('accessory GLBs use their declared head pivot instead of an exported rig rest translation @E18-AC01', async () => {
  const { vi } = await import('vitest');
  const { Group, Mesh, BoxGeometry, MeshBasicMaterial } = await import('three');
  const { AssetRegistry } = await import('../../../src/assets/registry');
  const { CrowdAccessories } = await import('../../../src/render/characters/CrowdAccessories');
  const root = new Group(), head = new Group(); head.name='head'; head.position.y=1.5;
  const hat = new Mesh(new BoxGeometry(.2,.1,.2),new MeshBasicMaterial({color:'#476678'}));hat.position.y=.4;head.add(hat);root.add(head);
  const load = vi.spyOn(AssetRegistry.prototype,'loadAsset').mockResolvedValue(root);
  const accessories = new CrowdAccessories();accessories.ids.splice(0,accessories.ids.length,'acc.test-hat');
  try {
    await accessories.init();
    for(const mesh of accessories.children as import('three').InstancedMesh[]) {
      mesh.geometry.computeBoundingBox();expect(mesh.geometry.boundingBox!.min.y).toBeCloseTo(.35);expect(mesh.geometry.boundingBox!.max.y).toBeCloseTo(.45);
    }
    expect(accessories.slot({id:1,archetype:'infected.alpha',infected:{variant:'infected.alpha'}} as unknown as import('../../../src/sim/world/types').EntitySnapshot)).toBe(0);
  } finally { accessories.dispose(); load.mockRestore(); hat.geometry.dispose(); (hat.material as import('three').Material).dispose(); }
});
