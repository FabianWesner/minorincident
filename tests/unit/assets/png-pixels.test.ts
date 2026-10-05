import { expect, test } from 'vitest';
import { PNG } from 'pngjs';
import { getPixels, savePixels } from 'ndarray-pixels';

test('T-E17-images @E17 PNG atlas adapter preserves RGBA pixels without native image dependencies', async () => {
  const image=new PNG({width:2,height:1});image.data.set([255,0,0,128,0,255,0,255]);
  const pixels=await getPixels(PNG.sync.write(image),'image/png');
  expect(pixels.shape).toEqual([2,1,4]);
  expect(pixels.get(0,0,3)).toBe(128);expect(pixels.get(1,0,1)).toBe(255);
  expect(PNG.sync.read(Buffer.from(await savePixels(pixels,'image/png'))).data).toEqual(image.data);
  await expect(getPixels(new Uint8Array(),'image/jpeg')).rejects.toThrow('must be PNG');
});
