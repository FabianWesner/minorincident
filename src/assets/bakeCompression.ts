/** Fetch may already decompress Content-Encoding: gzip; raw static-host bytes
 * still need inflation. Both responses contain the identical lossless payload. */
export async function decompressCivilianBake(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (header[0] !== 0x1f || header[1] !== 0x8b) return bytes;
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
