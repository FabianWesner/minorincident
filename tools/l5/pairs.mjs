// Side-by-side recognition sheets: the L4 (left) and L5 (right) frame of each pair camera, from the Scene Lab runs or the real-input shots.
// node tools/l5/pairs.mjs   (reads test-results/scenes/qa-l5-pair-<name>-{l4,l5}/shot-0005.png, writes test-results/epics/E23/pair-<name>.png)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const names = ['plaza', 'harbor-street', 'metro-entrance', 'kessler-lane'];
const W = 800;
const read = path => PNG.sync.read(readFileSync(path));
function scaled(src) {
  const h = Math.round(src.height * W / src.width), out = new PNG({ width: W, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(src.width - 1, Math.floor(x * src.width / W)), sy = Math.min(src.height - 1, Math.floor(y * src.height / h)), i = (y * W + x) * 4, j = (sy * src.width + sx) * 4;
    for (let k = 0; k < 4; k++) out.data[i + k] = src.data[j + k];
  }
  return out;
}
mkdirSync('test-results/epics/E23', { recursive: true });
for (const name of names) {
  const a = scaled(read(`test-results/scenes/qa-l5-pair-${name}-l4/shot-0005.png`)), b = scaled(read(`test-results/scenes/qa-l5-pair-${name}-l5/shot-0005.png`));
  const sheet = new PNG({ width: W * 2 + 4, height: a.height });
  sheet.data.fill(255);
  PNG.bitblt(a, sheet, 0, 0, W, a.height, 0, 0); PNG.bitblt(b, sheet, 0, 0, W, b.height, W + 4, 0);
  writeFileSync(`test-results/epics/E23/pair-${name}.png`, PNG.sync.write(sheet));
  console.log('wrote', name);
}
