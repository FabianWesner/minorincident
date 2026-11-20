// Reduce the retained TRELLIS hazmat source while retaining its UVs for palette sampling.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const source = process.argv[2] ?? '/Users/wesner/Workspace/trellis-highs/l4-inf.hazmat/tris300000_tex2048.glb';
const output = process.argv[3] ?? '/private/tmp/s186-trellis-hazmat.glb';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(source);
await doc.transform(weld());
for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const position = primitive.getAttribute('POSITION'), indices = primitive.getIndices(), uv = primitive.getAttribute('TEXCOORD_0');
  const [reduced] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices.getArray()), new Float32Array(position.getArray()), 3,
    new Float32Array(uv.getArray()), 2, [.15, .15], null, 22500, .08, ['Permissive']);
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setBuffer(indices.getBuffer()).setArray(reduced));
  compactPrimitive(primitive);
}
await io.write(output, doc);
