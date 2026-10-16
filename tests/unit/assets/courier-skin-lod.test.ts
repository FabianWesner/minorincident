import { expect, test } from 'vitest';
import { assetIO } from '../../../tools/assets/io';
import { simplifyCourierSkin, courierSkinLodError } from '../../../tools/assets/courier-skin-lod';

for (const variant of ['female', 'male']) test(`@E18-AC01 ${variant} low skin preserves vertices, influences and the complete rig`, async () => {
  const io = await assetIO(), path = `public/assets/models/char.courier-${variant}.skin`;
  const source = await io.read(`${path}.glb`), low = await io.read(`${path}.low.glb`);
  const rig = (document: typeof source) => document.getRoot().listNodes().map(node => ({ name: node.getName(), translation: node.getTranslation(), rotation: node.getRotation(), scale: node.getScale(), children: node.listChildren().map(child => child.getName()) }));
  expect(rig(low)).toEqual(rig(source));
  expect(low.getRoot().listSkins().map(skin => skin.listJoints().map(joint => joint.getName()))).toEqual(source.getRoot().listSkins().map(skin => skin.listJoints().map(joint => joint.getName())));
  const original = source.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  const reduced = low.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  expect(reduced).toHaveLength(original.length);
  for (let i = 0; i < original.length; i++) {
    expect(reduced[i].listSemantics()).toEqual(original[i].listSemantics());
    for (const semantic of original[i].listSemantics()) {
      const before = original[i].getAttribute(semantic)!, after = reduced[i].getAttribute(semantic)!;
      expect(after.getNormalized()).toBe(before.getNormalized());
      expect(after.getArray(), semantic).toEqual(before.getArray());
    }
    expect(reduced[i].getMaterial()?.getName()).toBe(original[i].getMaterial()?.getName());
  }
  const proof = await simplifyCourierSkin(source);
  expect(proof.after).toBeLessThanOrEqual(30_000);
  expect(proof.after).toBeLessThan(proof.before);
  expect(proof.error).toBeLessThanOrEqual(courierSkinLodError);
  // Rebuild the actual output from its source, rather than accepting a stale bake.
  // Meshopt's index encoder can cyclically rotate a triangle. Compare the
  // serialized rebuild through the same codec as the checked-in GLB.
  const encoded = await io.readBinary(await io.writeBinary(source));
  const rebuilt = encoded.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  for (let i = 0; i < reduced.length; i++) expect(reduced[i].getIndices()!.getArray()).toEqual(rebuilt[i].getIndices()!.getArray());
});
