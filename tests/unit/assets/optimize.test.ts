import { readFileSync } from 'node:fs';
import { getBounds } from '@gltf-transform/functions';
import { expect, test } from 'vitest';
import { assetIO } from '../../../tools/assets/io';
import { validateDocument } from '../../../tools/assets/validate';
import { normalizeForward, optimizeDocument } from '../../../tools/assets/optimize';
import type { AssetDef } from '../../../src/assets/types';
import { fixture } from './fixture';
import { compressTextures } from '../../../tools/assets/textures';

test('T-E17-03 @E17-AC03 join/quantize/meshopt preserve named parts and world pivots through roundtrip', async () => {
  const { doc, def } = fixture();
  const body = doc.getRoot().listNodes()[0];
  body.setTranslation([3.123, 2.234, -4.345]);
  doc.getRoot().listNodes()[1].setTranslation([6.123, 2.234, -4.345]);
  const wheel = doc.createNode('wheel').setMesh(body.getMesh()).setTranslation([.31, .4, .52]);
  body.addChild(wheel);
  def.requiredNodes.push('wheel'); def.animatedNodes.push('wheel');
  const before = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n.getWorldTranslation()]));
  await optimizeDocument(doc, def);
  const io = await assetIO(), result = await io.readBinary(await io.writeBinary(doc));
  for (const [name, pivot] of before) {
    const nodes = result.getRoot().listNodes().filter((n) => n.getName() === name);
    expect(nodes).toHaveLength(1);
    expect(Math.hypot(...nodes[0].getWorldTranslation().map((v, i) => v - pivot[i]))).toBeLessThanOrEqual(.001);
  }
  expect(result.getRoot().listNodes().find((n) => n.getName() === 'wheel')!.listChildren().some((n) => !!n.getMesh())).toBe(true);
});
test('T-E17-03b @E17-AC03 static siblings join while their named assembly pivot stays fixed', async () => {
  const {doc,def}=fixture(), body=doc.getRoot().listNodes()[0], mesh=body.getMesh()!;
  body.setMesh(null); body.setTranslation([.12,.34,.56]);
  doc.getRoot().listNodes()[1].setTranslation([3,.34,.56]);
  body.addChild(doc.createNode('panelA').setMesh(mesh));
  body.addChild(doc.createNode('panelB').setMesh(mesh).setTranslation([1,0,0]));
  const pivot=body.getWorldTranslation();
  await optimizeDocument(doc,def);
  expect(body.getWorldTranslation()).toEqual(pivot);
  expect(body.listChildren().filter(n=>n.getMesh()?.listPrimitives().length)).toHaveLength(1);
});
test('T-E17-03c @E17-AC03 texture-free builds work without toktx and atlas encoder failures are fatal', () => {
  const {doc}=fixture();
  expect(()=>compressTextures(doc,'/missing/e17-toktx')).not.toThrow();
  doc.createTexture().setImage(new Uint8Array([1,2,3])).setMimeType('image/png');
  expect(()=>compressTextures(doc,'/missing/e17-toktx')).toThrow('configure TOKTX_BIN');
});

test('T-E17-03d @E17-AC03 normalization rotates the whole assembly and is idempotent', () => {
  const { doc, def } = fixture();
  const body = doc.getRoot().listNodes()[0], front = doc.getRoot().listNodes()[1];
  front.setTranslation([0,0,2]);
  const joint = doc.createNode('joint').setTranslation([0,.5,1]); body.addChild(joint);
  const local = joint.getMatrix();
  normalizeForward(doc,def);
  expect(front.getWorldTranslation()[0]).toBeCloseTo(2);
  expect(front.getWorldTranslation()[2]).toBeCloseTo(0);
  expect(joint.getMatrix()).toEqual(local);
  const world = joint.getWorldMatrix();
  normalizeForward(doc,def);
  expect(joint.getWorldMatrix()).toEqual(world);
});
test('T-E17-02c @E17-AC02 absent front markers require an explicit source direction', () => {
  const {doc,def} = fixture(); doc.getRoot().listNodes()[1].dispose();
  expect(() => normalizeForward(doc,def)).toThrow('declare sourceForward');
  def.sourceForward = '-X'; normalizeForward(doc,def);
  expect(doc.getRoot().listNodes().find(n=>n.getName()==='front')!.getWorldTranslation()[0]).toBeGreaterThan(0);
});
test('T-E17-02d @E17-AC02 optimization removes zero-area faces through compressed roundtrip', async () => {
  const {doc,def} = fixture();
  const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0], pos = primitive.getAttribute('POSITION')!;
  pos.setArray(new Float32Array([0,0,0, 1,0,0, 0,1,1, .5,0,0]));
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2,0,3,1])).setBuffer(pos.getBuffer()));
  await optimizeDocument(doc,def);
  const io = await assetIO(), result = await io.readBinary(await io.writeBinary(doc));
  expect(result.getRoot().listMeshes()[0].listPrimitives()[0].getIndices()!.getCount()).toBe(3);
});

test('T-E17-scale @E17-AC03 uniform scale preserves local joints and applies once', async () => {
  const {doc,def}=fixture(); def.sourceScale=1.25;
  const body=doc.getRoot().listNodes()[0], local=body.getMatrix();
  await optimizeDocument(doc,def);
  expect(body.getMatrix()).toEqual(local);
  expect(body.getWorldScale()).toEqual([1.25,1.25,1.25]);
  await optimizeDocument(doc,def);
  expect(body.getWorldScale()).toEqual([1.25,1.25,1.25]);
});

test('T-E17-caps @E17-AC11 exported caps survive compression and stay on the surviving joint side', async () => {
  const io=await assetIO();
  const {default:manifest}=await import('../../../src/assets/manifest.json');
  const def=manifest.find(d=>d.id==='inf.common-worker')! as AssetDef;
  const doc=await io.read(def.sourceGlb!);
  await optimizeDocument(doc,def,.03);
  const result=await io.readBinary(await io.writeBinary(doc));
  expect(validateDocument(result,def,0).errors.filter(e=>e.startsWith('dimensions.') || e.startsWith('stump_'))).toEqual([]);
  for (const name of ['head','armL','armR','foreArmL','foreArmR','legL','legR']) {
    const limb=result.getRoot().listNodes().find(n=>n.getName()===name)!;
    const cap=result.getRoot().listNodes().find(n=>n.getName()===`stump_${name}`)!;
    expect(cap.getExtras().hidden).toBe(true);
    expect(cap.getParentNode()).toBe(limb.getParentNode());
    expect(cap.getWorldTranslation()).toEqual(limb.getWorldTranslation());
    expect(cap.getWorldScale().every(v=>v>0)).toBe(true);
    let triangles=0;cap.traverse(n=>{for(const p of n.getMesh()?.listPrimitives()??[])triangles+=(p.getIndices()?.getCount()??0)/3;});
    expect(triangles).toBe(56);
    const parent=cap.getParentNode()!;parent.removeChild(limb);
    expect(cap.getParentNode()).toBe(parent);
  }
});


test('T-E17-height @E17-AC02 adult exports stay 1.75–1.85 m at every LOD', async () => {
  const {default:manifest}=await import('../../../src/assets/manifest.json'), io=await assetIO();
  const exceptions=new Set(['char.corgi','npc.brother','npc.civilian-kid','inf.crawler','inf.brute','inf.teen-skater']);
  for(const def of manifest as AssetDef[]) {
    if(!def.sourceGlb || !['character','infected'].includes(def.category) || exceptions.has(def.id)) continue;
    for(const path of [def.glb,def.lods?.lod1,def.lods?.lod2].filter((p):p is string=>!!p)) {
      const doc=await io.read(path),bounds=getBounds(doc.getRoot().listScenes()[0]),height=bounds.max[1]-bounds.min[1];
      expect(height,path).toBeGreaterThanOrEqual(1.75);expect(height,path).toBeLessThanOrEqual(1.85);
    }
  }
});

test('T-E17-lanes @E17-AC02 road vehicle envelopes including mirrors fit district lanes at every LOD', async () => {
  const layout=JSON.parse(readFileSync('public/assets/layouts/D-MAIN.layout.json','utf8'));
  const lane=Math.min(...layout.roads.edges.map((edge:{laneWidth:number})=>edge.laneWidth/2));
  const {default:manifest}=await import('../../../src/assets/manifest.json'),io=await assetIO();
  for(const def of manifest as AssetDef[]) {
    // Aircraft retain their authored rotor span; the separate aircraft contract checks all LODs.
    if(def.category!=='vehicle' || def.id==='veh.helicopter' || (!def.sourceGlb && def.status!=='integrated')) continue;
    for(const path of [def.glb,def.lods?.lod1,def.lods?.lod2].filter((p):p is string=>!!p)) {
      const doc=await io.read(path),bounds=getBounds(doc.getRoot().listScenes()[0]);
      expect(bounds.max[2]-bounds.min[2],path).toBeLessThan(lane-.1);
    }
  }
});


test('T-E17-aircraft @E17-AC02 helicopter preserves authored scale and rotor pivots at every LOD', async () => {
  const {default:manifest}=await import('../../../src/assets/manifest.json'),io=await assetIO();
  const def=manifest.find(d=>d.id==='veh.helicopter')! as AssetDef;
  expect(def.sourceGlb).toBe('assets/veh.helicopter/model.glb');
  for(const path of [def.glb,def.lods?.lod1,def.lods?.lod2].filter((p):p is string=>!!p)) {
    const doc=await io.read(path),bounds=getBounds(doc.getRoot().listScenes()[0]);
    expect(bounds.max[2]-bounds.min[2],path).toBeGreaterThan(9);
    expect(validateDocument(doc,def,0).errors.filter(e=>e.startsWith('dimensions.') || e.startsWith('animated '))).toEqual([]);
    for(const name of ['mainRotor','tailRotor']) expect(doc.getRoot().listNodes().some(n=>n.getName()===name),`${path}:${name}`).toBe(true);
  }
});
