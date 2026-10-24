import { writeFileSync } from 'node:fs';
import { dedup, meshopt, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { assetIO } from './io';
import { consolidateMeshopt } from './compress';

/** Layouts and crowd bakes keep their hierarchy and extras; the build scripts supply raw exports. */
export async function packStatic(path: string): Promise<void> {
  const io = await assetIO(), document = await io.read(path);
  const extensions = document.getRoot().listExtensionsUsed().map(extension => extension.extensionName);
  const skinned = document.getRoot().listSkins().length > 0;
  if (extensions.includes('EXT_meshopt_compression') && (skinned || extensions.includes('KHR_mesh_quantization'))) return;
  if (path.endsWith('.horizon.glb')) {
    // Horizon spans hundreds of metres. Quantizing its positions can move outer
    // edges past streamed cells or break their 2 cm support seam contract.
    await document.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }), quantize({ pattern: /^(NORMAL|COLOR_0)$/, quantizeNormal: 8, quantizeColor: 8 }), reorder({ encoder: MeshoptEncoder }));
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  } else if (skinned) {
    // Position quantization rescales skinned meshes outside their bone transforms and changes their pose/size.
    await document.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }), quantize({ pattern: /^(COLOR_0|WEIGHTS_0)$/, quantizeColor: 16, quantizeWeight: 16 }), reorder({ encoder: MeshoptEncoder }));
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  } else {
    await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 14, quantizeNormal: 8, cleanup: false }));
  }
  writeFileSync(path, await consolidateMeshopt(await io.writeBinary(document)));
}
