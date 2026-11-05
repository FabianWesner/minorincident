import { PNG } from 'pngjs';
import ndarray from 'ndarray';

// glTF Transform's pixel API, restricted to our PNG palette atlases.
// Geometry transforms never call this; texture operations remain native-free.
export async function getPixels(bytes, mimeType) {
  if (mimeType !== 'image/png') throw new Error('Asset textures must be PNG');
  const image = PNG.sync.read(Buffer.from(bytes));
  return ndarray(image.data, [image.width, image.height, 4], [4, image.width * 4, 1]);
}
export async function savePixels(pixels, mimeType) {
  if (mimeType !== 'image/png') throw new Error('Asset textures must be PNG');
  const [width, height, channels] = pixels.shape;
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    for (let channel = 0; channel < 4; channel++) image.data[offset + channel] = channel < channels ? pixels.get(x, y, channel) : 255;
  }
  return PNG.sync.write(image);
}
