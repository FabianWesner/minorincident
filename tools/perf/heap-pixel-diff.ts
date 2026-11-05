/** Exact pixel comparison; no alignment, masks, resizing or tolerance. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [before, after, output] = process.argv.slice(2);
if (!before || !after || !output) throw Error('Usage: tsx tools/perf/heap-pixel-diff.ts before after output');
mkdirSync(output, { recursive: true });
const rows = readdirSync(before).filter(name => name.endsWith('.png')).map(name => {
  const a = PNG.sync.read(readFileSync(`${before}/${name}`)), b = PNG.sync.read(readFileSync(`${after}/${name}`));
  if (a.width !== b.width || a.height !== b.height) throw Error(`Size changed: ${name}`);
  const diff = new PNG({ width: a.width, height: a.height });
  let changedPixels = 0, absoluteError = 0, maxChannelError = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(a.data[i + c] - b.data[i + c]);
      changed ||= delta !== 0; absoluteError += delta; maxChannelError = Math.max(maxChannelError, delta);
      diff.data[i + c] = delta;
    }
    diff.data[i + 3] = 255; changedPixels += Number(changed);
  }
  writeFileSync(`${output}/${name}`, PNG.sync.write(diff));
  return { name, width: a.width, height: a.height, changedPixels, changedFraction: changedPixels / (a.width * a.height), meanChannelError: absoluteError / (a.width * a.height * 3), maxChannelError };
});
writeFileSync(`${output}/pixels.json`, JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
if (rows.some(r => r.changedPixels)) process.exitCode = 1;
