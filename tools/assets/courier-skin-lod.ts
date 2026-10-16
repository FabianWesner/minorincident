import { pathToFileURL } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
import type { Document } from '@gltf-transform/core';
import { assetIO } from './io';

/** Bound positions, normals, colours and skin influences together. The output
 * references original vertices only; joints, sockets and animations are intact. */
export const courierSkinLodError = .002;
export async function simplifyCourierSkin(document: Document): Promise<{ before: number; after: number; error: number }> {
  await MeshoptSimplifier.ready;
  let before = 0, after = 0, error = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION')!;
    const attributes = primitive.listSemantics().filter(name => name !== 'POSITION').map(name => primitive.getAttribute(name)!);
    const stride = attributes.reduce((n, attribute) => n + attribute.getElementSize(), 0);
    const values = new Float32Array(positions.getCount() * stride), row: number[] = [];
    for (let i = 0; i < positions.getCount(); i++) {
      let offset = i * stride;
      for (const attribute of attributes) {
        attribute.getElement(i, row);
        for (let c = 0; c < attribute.getElementSize(); c++) values[offset++] = row[c];
      }
    }
    const source = primitive.getIndices()!, indices = new Uint32Array(source.getArray()!);
    const [reduced, measuredError] = MeshoptSimplifier.simplifyWithAttributes(indices, new Float32Array(positions.getArray()!), 3, values, stride, Array(stride).fill(1), null, 0, courierSkinLodError, ['LockBorder']);
    primitive.setIndices(source.clone().setArray(reduced));
    if (source.listParents().length === 1) source.dispose();
    before += indices.length / 3; after += reduced.length / 3; error = Math.max(error, measuredError);
  }
  return { before, after, error };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const io = await assetIO();
  for (const variant of ['female', 'male']) {
    const source = `public/assets/models/char.courier-${variant}.skin.glb`;
    const document = await io.read(source), proof = await simplifyCourierSkin(document);
    await io.write(source.replace('.skin.glb', '.skin.low.glb'), document);
    console.log(JSON.stringify({ variant, ...proof }));
  }
}
