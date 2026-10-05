import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

/** Side-by-side vision sheet: reference left, deterministic render + 100 px grid right. */
export function compare(reference: string, render: string, output: string): void {
  const images = [PNG.sync.read(readFileSync(reference)), PNG.sync.read(readFileSync(render))];
  const sheet = new PNG({ width: 1600, height: 450 });
  for (let side = 0; side < 2; side++) {
    const image = images[side];
    for (let y = 0; y < 450; y++) for (let x = 0; x < 800; x++) {
      const source = (Math.floor(y * image.height / 450) * image.width + Math.floor(x * image.width / 800)) * 4;
      const target = (y * 1600 + x + side * 800) * 4;
      for (let c = 0; c < 3; c++) sheet.data[target + c] = side === 1 && (x % 100 === 0 || y % 100 === 0) ? image.data[source + c] * 0.8 + 51 : image.data[source + c];
      sheet.data[target + 3] = 255;
    }
  }
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, PNG.sync.write(sheet));
}
if (process.argv[1]?.endsWith('compare.ts')) {
  const [reference, render, output] = process.argv.slice(2);
  if (!reference || !render || !output) throw new Error('Usage: tsx tools/compare.ts reference.png render.png output.png');
  compare(reference, render, output);
}
