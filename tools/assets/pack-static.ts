import { writeFileSync } from 'node:fs';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { assetIO } from './io';
import { consolidateMeshopt } from './compress';

/** Layouts and crowd bakes keep their hierarchy and extras; the build scripts supply raw exports. */
export async function packStatic(path: string): Promise<void> {
  const io = await assetIO(), document = await io.read(path);
  const extensions = document.getRoot().listExtensionsUsed().map(extension => extension.extensionName);
  if (extensions.includes('EXT_meshopt_compression') && extensions.includes('KHR_mesh_quantization')) return;
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 14, quantizeNormal: 8, cleanup: false }));
  writeFileSync(path, await consolidateMeshopt(await io.writeBinary(document)));
}
