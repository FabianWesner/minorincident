interface UploadBuffer {
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}
export interface FloatUploadDevice {
  createBuffer(options: { label: string; size: number; usage: number; mappedAtCreation: boolean }): UploadBuffer;
  createCommandEncoder(options: { label: string }): {
    copyBufferToTexture(source: { buffer: UploadBuffer; bytesPerRow: number; rowsPerImage: number }, destination: { texture: object }, size: { width: number; height: number; depthOrArrayLayers: number }): void;
    finish(): object;
  };
  queue: { submit(commands: object[]): void };
}

/** Lossless upload for float pose atlases. A mapped COPY_SRC buffer avoids the
 * native writeTexture conversion/staging path; each row must be 256-byte aligned.
 * Submit before Three's draw so the queue orders the copy before texture reads. */
export function uploadFloatTexture(device: FloatUploadDevice, texture: object, pixels: Float32Array, width: number, height: number): void {
  const rowBytes = width * 16, stride = Math.ceil(rowBytes / 256) * 256;
  const buffer = device.createBuffer({ label: 'pose atlas upload', size: stride * height, usage: 4 /* COPY_SRC */, mappedAtCreation: true });
  const target = new Uint8Array(buffer.getMappedRange());
  const source = new Uint8Array(pixels.buffer, pixels.byteOffset, rowBytes * height);
  if (stride === rowBytes) target.set(source);
  else for (let row = 0; row < height; row++) target.set(source.subarray(row * rowBytes, (row + 1) * rowBytes), row * stride);
  buffer.unmap();
  const encoder = device.createCommandEncoder({ label: 'pose atlas upload' });
  encoder.copyBufferToTexture({ buffer, bytesPerRow: stride, rowsPerImage: height }, { texture }, { width, height, depthOrArrayLayers: 1 });
  device.queue.submit([encoder.finish()]);
  // Destroy after submission: WebGPU retains storage for already submitted work.
  buffer.destroy();
}
