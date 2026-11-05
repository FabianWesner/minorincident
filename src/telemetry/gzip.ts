/** gzip through the platform CompressionStream (browsers and Node 18+). */
async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export const gzip = (bytes: Uint8Array): Promise<Uint8Array> => pipe(bytes, new CompressionStream('gzip'));
export const gunzip = (bytes: Uint8Array): Promise<Uint8Array> => pipe(bytes, new DecompressionStream('gzip'));
