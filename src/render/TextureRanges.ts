import { FloatType, RGBAFormat, type DataTexture, type Texture } from 'three';

interface Backend {
  updateTexture(texture: Texture, options: unknown): void;
  get(texture: Texture): { textureGPU?: WebGLTexture; texture?: object; glTextureType: number; glFormat: number; glType: number };
  gl?: WebGL2RenderingContext;
  state?: { bindTexture(target: number, texture: WebGLTexture): void };
  textureUtils?: { setTextureParameters(target: number, texture: Texture): void };
  device?: { queue: { writeTexture(target: { texture: object; origin: { x: number; y: number; z: number } }, data: Float32Array, layout: { bytesPerRow: number }, size: { width: number; height: number; depthOrArrayLayers: number }): void } };
}

/** r186's common backends ignore Texture.updateRanges for 2D data textures.
 * Support whole-row RGBA float ranges used by crowd atlases, after a full cold
 * upload. A recreated GPU texture also receives every immutable clip row. */
export function installTextureRanges(value: unknown): void {
  const backend = value as Backend, original = backend.updateTexture.bind(backend);
  const uploaded = new WeakMap<Texture, object>();
  backend.updateTexture = (texture, options) => {
    const data = backend.get(texture), resource = data.textureGPU ?? data.texture;
    const image = (texture as DataTexture).image, width = image?.width, row = width * 4;
    const ranges = texture.updateRanges;
    const partial = (texture as DataTexture).isDataTexture && texture.type === FloatType && texture.format === RGBAFormat
      && !texture.flipY && !texture.generateMipmaps && !texture.mipmaps.length && image.data instanceof Float32Array
      && resource && uploaded.get(texture) === resource && ranges.length
      && ranges.every(r => r.start >= 0 && r.count > 0 && r.start % row === 0 && r.count % row === 0 && r.start + r.count <= image.data!.length);
    if (!partial) {
      original(texture, options);
      if (resource) uploaded.set(texture, resource);
      texture.clearUpdateRanges(); return;
    }
    const pixels = image.data as Float32Array;
    if (backend.gl) {
      backend.state!.bindTexture(data.glTextureType, data.textureGPU!);
      backend.textureUtils!.setTextureParameters(data.glTextureType, texture);
      for (const r of ranges) backend.gl.texSubImage2D(data.glTextureType, 0, 0, r.start / row, width, r.count / row, data.glFormat, data.glType, pixels.subarray(r.start, r.start + r.count));
    } else {
      for (const r of ranges) backend.device!.queue.writeTexture({ texture: data.texture!, origin: { x: 0, y: r.start / row, z: 0 } }, pixels.subarray(r.start, r.start + r.count), { bytesPerRow: row * 4 }, { width, height: r.count / row, depthOrArrayLayers: 1 });
    }
    texture.clearUpdateRanges();
  };
}
