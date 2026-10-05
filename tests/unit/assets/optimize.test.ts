import { expect, test } from 'vitest';
import { assetIO } from '../../../tools/assets/io';
import { normalizeForward, optimizeDocument } from '../../../tools/assets/optimize';
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
