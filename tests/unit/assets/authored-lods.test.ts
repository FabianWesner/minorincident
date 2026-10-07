import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BoxGeometry } from 'three';
import { fixture } from './fixture';
import { assetIO } from '../../../tools/assets/io';
import { packAsset } from '../../../tools/assets/pack';
import { triangleCount } from '../../../tools/assets/delivery';

// Regression for the actual pack entry point: authored 50%/25% tiers used to
// get silently replaced by 12%/3% geometry with their hard normals stripped.
test('packing reviewed authored LODs preserves triangles, sharp normals and provenance', async () => {
  const directory = mkdtempSync('assets/prop.authored-lod-test-');
  try {
    const io = await assetIO(), { def } = fixture();
    def.id = directory.slice('assets/'.length);
    def.sourceGlb = join(directory, 'model.glb');
    def.glb = join(directory, 'packed/model.glb');
    def.lods = { lod1: join(directory, 'packed/model.lod1.glb'), lod2: join(directory, 'packed/model.lod2.glb') };
    def.authoredLodRatios = { lod1: .6, lod2: .3 };
    mkdirSync(join(directory, 'packed'));
    const counts: number[] = [];
    for (const [level, segments] of [[0, [2, 2, 2]], [1, [1, 1, 3]], [2, [1, 1, 1]]] as const) {
      const { doc } = fixture(), buffer = doc.getRoot().listBuffers()[0];
      const box = new BoxGeometry(1, 1, 1, ...segments);
      const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
      for (const [semantic, attribute] of [['POSITION', 'position'], ['NORMAL', 'normal']] as const) {
        primitive.setAttribute(semantic, doc.createAccessor().setType('VEC3').setArray(Float32Array.from(box.getAttribute(attribute).array)).setBuffer(buffer));
      }
      primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from(box.getIndex()!.array)).setBuffer(buffer));
      counts.push(triangleCount(doc));
      await io.write(join(directory, `model${level ? `.lod${level}` : ''}.glb`), doc);
      box.dispose();
    }
    expect(await packAsset(def)).toBe(0);
    for (const [level, path] of [def.glb, def.lods.lod1!, def.lods.lod2!].entries()) {
      const packed = await io.read(path);
      expect(triangleCount(packed)).toBe(counts[level]);
      expect(packed.getRoot().listScenes()[0].getExtras().deliveryLodGenerated).toBeUndefined();
      for (const mesh of packed.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        const normal = primitive.getAttribute('NORMAL')!;
        expect(normal).toBeTruthy();
        const value: number[] = [];
        for (let i = 0; i < normal.getCount(); i++) {
          normal.getElement(i, value);
          expect(value.filter(v => Math.abs(v) > .01)).toHaveLength(1);
        }
      }
    }
    await expect(packAsset(def, true)).rejects.toThrow('rebuild reviewed LODs');
    rmSync(join(directory, 'model.lod1.glb'));
    await expect(packAsset(def)).rejects.toThrow('missing authored lod1');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('packing mixed RGB and RGBA AO keeps each primitive stream and its indices aligned', async () => {
  const { doc, def } = fixture(), buffer = doc.getRoot().listBuffers()[0];
  const mesh = doc.getRoot().listMeshes()[0];
  mesh.listPrimitives()[0].dispose();
  for (const size of [3, 4]) {
    const box = new BoxGeometry(1, 1, 1), count = box.getAttribute('position').count;
    const position = doc.createAccessor().setType('VEC3').setArray(Float32Array.from(box.getAttribute('position').array)).setBuffer(buffer);
    const normal = doc.createAccessor().setType('VEC3').setArray(Float32Array.from(box.getAttribute('normal').array)).setBuffer(buffer);
    const color = doc.createAccessor().setType(size === 3 ? 'VEC3' : 'VEC4').setArray(Float32Array.from({ length: count * size }, (_, i) => i % size === 3 ? .5 : .8)).setBuffer(buffer);
    const indices = doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from(box.getIndex()!.array)).setBuffer(buffer);
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', position).setAttribute('NORMAL', normal).setAttribute('COLOR_0', color).setIndices(indices).setMaterial(doc.createMaterial(`pal_${size === 3 ? 'brick' : 'asphalt'}`)));
    box.dispose();
  }
  const { optimizeDocument } = await import('../../../tools/assets/optimize');
  await optimizeDocument(doc, def);
  const io = await assetIO(), packed = await io.readBinary(await io.writeBinary(doc));
  expect(triangleCount(packed)).toBe(24);
  for (const packedMesh of packed.getRoot().listMeshes()) for (const primitive of packedMesh.listPrimitives()) {
    const count = primitive.getAttribute('POSITION')!.getCount();
    for (const attribute of primitive.listAttributes()) expect(attribute.getCount()).toBe(count);
    for (const index of primitive.getIndices()!.getArray()!) expect(index).toBeLessThan(count);
  }
});
