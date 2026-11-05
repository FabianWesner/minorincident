/** Keep geometry-only GLTFLoader probes browser-independent when a GLB adds image maps. */
export function stripGlbTextures(source: Uint8Array): ArrayBuffer {
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) return source.slice().buffer;
  const jsonLength = view.getUint32(12, true), jsonStart = 20;
  const json = JSON.parse(new TextDecoder().decode(source.subarray(jsonStart, jsonStart + jsonLength))) as {
    materials?: Record<string, unknown>[];
    images?: unknown[]; textures?: unknown[]; samplers?: unknown[];
    extensionsUsed?: string[]; extensionsRequired?: string[];
  };
  for (const material of json.materials ?? []) {
    delete material.baseColorTexture;
    delete material.normalTexture;
    delete material.emissiveTexture;
    delete material.occlusionTexture;
    const pbr = material.pbrMetallicRoughness as Record<string, unknown> | undefined;
    if (pbr) delete pbr.baseColorTexture;
    const extensions = material.extensions as Record<string, unknown> | undefined;
    if (extensions) { delete extensions.KHR_materials_pbrSpecularGlossiness; delete extensions.KHR_materials_clearcoat; }
  }
  delete json.images; delete json.textures; delete json.samplers;
  const imageExtensions = new Set(['EXT_texture_webp', 'KHR_texture_basisu']);
  if (json.extensionsUsed) json.extensionsUsed = json.extensionsUsed.filter(extension => !imageExtensions.has(extension));
  if (json.extensionsRequired) json.extensionsRequired = json.extensionsRequired.filter(extension => !imageExtensions.has(extension));
  const encoded = new TextEncoder().encode(JSON.stringify(json)), paddedLength = Math.ceil(encoded.length / 4) * 4;
  const binChunkHeader = jsonStart + jsonLength, binStart = binChunkHeader + 8;
  const bin = source.subarray(binStart), out = new Uint8Array(12 + 8 + paddedLength + 8 + bin.length), outView = new DataView(out.buffer);
  outView.setUint32(0, 0x46546c67, true); outView.setUint32(4, 2, true); outView.setUint32(8, out.length, true);
  outView.setUint32(12, paddedLength, true); outView.setUint32(16, 0x4e4f534a, true); out.set(encoded, 20); out.fill(0x20, 20 + encoded.length, 20 + paddedLength);
  outView.setUint32(20 + paddedLength, bin.length, true); outView.setUint32(24 + paddedLength, 0x004e4942, true); out.set(bin, 28 + paddedLength);
  return out.buffer;
}
