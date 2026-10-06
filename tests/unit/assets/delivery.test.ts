import { expect, test } from 'vitest';
import { BoxGeometry } from 'three';
import { getBounds } from '@gltf-transform/functions';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { optimizeDocument } from '../../../tools/assets/optimize';
import { requiredLods, triangleCount } from '../../../tools/assets/delivery';
import { fixture } from './fixture';
import { validateDocument } from '../../../tools/assets/validate';

test('delivery LOD policy exempts only small handhelds and distant assets', () => {
  const { def } = fixture();
  expect(requiredLods(def, 100)).toEqual(['lod1', 'lod2']);
  expect(requiredLods({ ...def, id: 'wpn.test' }, 2000)).toEqual([]);
  expect(requiredLods({ ...def, id: 'wpn.test' }, 2001)).toEqual(['lod1']);
  expect(requiredLods({ ...def, tier: 'distant' }, 2001)).toEqual([]);
});

test('delivery bundling quantizes shared material primitives once and preserves LOD0 silhouette', async () => {
  const io = await assetIO();
  for (const id of ['wpn.machete', 'char.corgi', 'bld.house-a']) {
    const def = manifest.find(def => def.id === id)! as AssetDef;
    const document = await io.read(def.sourceGlb!);
    // Normalization is already checked by the existing contract suite. The weapon
    // has seven material pieces, making double quantization immediately visible.
    if (id !== 'wpn.machete') { await optimizeDocument(document, def); continue; }
    const before = getBounds(document.getRoot().listScenes()[0]);
    const triangles = triangleCount(document);
    await optimizeDocument(document, def);
    const result = await io.readBinary(await io.writeBinary(document));
    const after = getBounds(result.getRoot().listScenes()[0]);
    for (const bound of ['min', 'max'] as const) for (let axis = 0; axis < 3; axis++) expect(Math.abs(after[bound][axis] - before[bound][axis])).toBeLessThan(.002);
    expect(triangleCount(result)).toBeGreaterThanOrEqual(triangles * .97);
    expect(triangleCount(result)).toBeLessThanOrEqual(triangles);
    expect(result.getRoot().listMaterials().map(material => material.getName()).sort()).toEqual(document.getRoot().listMaterials().map(material => material.getName()).sort());
    expect(result.getRoot().listNodes().some(node => (node.getMesh()?.listPrimitives().length ?? 0) > 1)).toBe(true);
  }
});

test('meshopt block consolidation keeps all decoded vertex and animation data identical', async () => {
  const { consolidateMeshopt } = await import('../../../tools/assets/compress');
  const io = await assetIO();
  const def = manifest.find(def => def.id === 'char.survivor-female')!;
  const original = await io.read(def.lods!.lod1!);
  const split = await io.writeBinary(original), packed = await consolidateMeshopt(split);
  const decoded = await io.readBinary(packed);
  const attributes = (document: typeof original) => document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives().flatMap(primitive => [primitive.getIndices()!, ...primitive.listAttributes()].map(accessor => ({ type: accessor.getType(), normalized: accessor.getNormalized(), values: Array.from(accessor.getArray()!) }))));
  expect(attributes(decoded)).toEqual(attributes(original));
  expect(decoded.getRoot().listAnimations().map(animation => animation.getName())).toEqual(original.getRoot().listAnimations().map(animation => animation.getName()));
  expect(packed.length).toBeLessThan(split.length);
});

test('delivery keeps skin joints and morph animation channels on the geometry node', async () => {
  const { doc, def } = fixture(), root = doc.getRoot();
  const body = root.listNodes().find(node => node.getName() === 'body')!;
  body.getMesh()!.setName('body');
  const joint = doc.createNode('joint'); root.listScenes()[0].addChild(joint);
  const skin = doc.createSkin('rig').addJoint(joint); body.setSkin(skin).setWeights([.3]);
  const primitive = body.getMesh()!.listPrimitives()[0], count = primitive.getAttribute('POSITION')!.getCount();
  primitive.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint16Array(count * 4)).setBuffer(root.listBuffers()[0]));
  primitive.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(Float32Array.from({ length: count * 4 }, (_, index) => index % 4 === 0 ? 1 : 0)).setBuffer(root.listBuffers()[0]));
  primitive.addTarget(doc.createPrimitiveTarget().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(count * 3)).setBuffer(root.listBuffers()[0])));
  const sampler = doc.createAnimationSampler().setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(root.listBuffers()[0]))
    .setOutput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(root.listBuffers()[0]));
  doc.createAnimation('morph').addSampler(sampler).addChannel(doc.createAnimationChannel().setSampler(sampler).setTargetNode(body).setTargetPath('weights'));
  await optimizeDocument(doc, def, .12);
  const io = await assetIO(), result = await io.readBinary(await io.writeBinary(doc));
  const geometry = result.getRoot().listAnimations()[0].listChannels()[0].getTargetNode()!;
  expect(geometry.getMesh()).not.toBeNull();
  expect(geometry.getMesh()!.getName()).toBe('');
  expect(geometry.getSkin()!.listJoints().map(joint => joint.getName())).toEqual(['joint']);
  expect(geometry.getWeights()).toEqual([.3]);
  expect(geometry.getMesh()!.listPrimitives()[0].listTargets()).toHaveLength(1);
});

test('delivery validator preserves intentionally empty source pivots but rejects removed limb geometry', async () => {
  const { doc, def } = fixture();
  const empty = doc.createNode('amputatedFoot'); doc.getRoot().listScenes()[0].addChild(empty);
  def.requiredNodes.push('amputatedFoot'); def.animatedNodes.push('amputatedFoot', 'body');
  const io = await assetIO(), packed = await io.readBinary(await io.writeBinary(doc));
  expect(validateDocument(packed, def, 0, 1, doc).errors.filter(error => error.startsWith('animated '))).toEqual([]);
  packed.getRoot().listNodes().find(node => node.getName() === 'body')!.setMesh(null);
  expect(validateDocument(packed, def, 0, 1, doc).errors).toContain('animated body: no separate geometry');
  packed.getRoot().listNodes().find(node => node.getName() === 'amputatedFoot')!.dispose();
  expect(validateDocument(packed, def, 0, 1, doc).errors).toContain('node amputatedFoot: expected exactly one, found 0');
});

test('distance tiers preserve disconnected thin panels inside a large assembly', async () => {
  const { doc, def } = fixture(), buffer = doc.getRoot().listBuffers()[0];
  def.sourceGlb = 'fixture.glb';
  const positions: number[] = [], indices: number[] = [];
  for (const x of [0, 20]) {
    const box = new BoxGeometry(1, .01, 1, 4, 4, 4), offset = positions.length / 3;
    const position = box.getAttribute('position');
    for (let i = 0; i < position.count; i++) positions.push(position.getX(i) + x, position.getY(i), position.getZ(i));
    for (const index of box.getIndex()!.array) indices.push(index + offset);
    box.dispose();
  }
  const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  primitive.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(positions)).setBuffer(buffer));
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(buffer));
  doc.getRoot().listNodes().find(node => node.getName() === 'front')!.setTranslation([22, 0, 0]);
  await optimizeDocument(doc, def, .03);
  const io = await assetIO(), result = await io.readBinary(await io.writeBinary(doc));
  const bounds = getBounds(result.getRoot().listScenes()[0]);
  expect(bounds.max[1] - bounds.min[1]).toBeGreaterThan(.008);
  expect(triangleCount(result)).toBeGreaterThan(0);
  expect(triangleCount(result)).toBeLessThan(indices.length / 3);
});

test('delivery preserves optional source roof geometry before manifest registration', async () => {
  const { doc, def } = fixture(); def.sourceGlb = 'fixture.glb';
  doc.getRoot().listScenes()[0].addChild(doc.createNode('roof').setMesh(doc.getRoot().listMeshes()[0]));
  const io = await assetIO(), source = await io.readBinary(await io.writeBinary(doc));
  await optimizeDocument(doc, def, .12);
  const packed = await io.readBinary(await io.writeBinary(doc));
  expect(validateDocument(packed, def, 0, 1, source).errors.filter(error => error.includes('roof'))).toEqual([]);
  const roof = packed.getRoot().listNodes().find(node => node.getName() === 'roof')!;
  roof.traverse(node => node.setMesh(null));
  expect(validateDocument(packed, def, 0, 1, source).errors).toContain('node roof: lost source geometry');
});
