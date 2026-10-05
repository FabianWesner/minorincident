import sharp from 'sharp';
import { existsSync } from 'node:fs';

export async function comparison(images: string[], reference: string, output: string): Promise<void> {
  const paths = existsSync(reference) ? [reference, ...images] : images;
  const tiles = await Promise.all(paths.map((path) => sharp(path).resize(600,338,{fit:'contain', background:'#2a2730'}).png().toBuffer()));
  await sharp({ create: { width: 1800, height: 338 * Math.ceil(tiles.length / 3), channels: 4, background: '#2a2730' } }).composite(tiles.map((input,i) => ({ input, left: i % 3 * 600, top: Math.floor(i/3)*338 }))).png().toFile(output);
}
