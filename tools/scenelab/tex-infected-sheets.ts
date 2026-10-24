/** Compose only game-camera captures and the approved source in the pipeline viewer; no camera or mesh edits. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const raw = '/private/tmp/tex-infected-captures', out = 'docs/reports/tex-infected';
const source = PNG.sync.read(readFileSync('/private/tmp/tex-infected-captures/pipeline-look.png'));
for (const backend of ['webgl2', 'webgpu']) for (const tier of ['high', 'low']) {
  const sheet = new PNG({ width: 2560 + source.width, height: 1440 }); sheet.data.fill(30); for (let i = 3; i < sheet.data.length; i += 4) sheet.data[i] = 255;
  for (const [row, zoom] of [1, 1.5].entries()) for (const [col, variant] of ['main', 'after'].entries()) {
    const capture = PNG.sync.read(readFileSync(`${raw}/${variant}-${backend}-${tier}-z${zoom}.png`));
    PNG.bitblt(capture, sheet, 0, 0, 1280, 720, col * 1280, row * 720);
  }
  PNG.bitblt(source, sheet, 0, 0, source.width, source.height, 2560, 0);
  writeFileSync(`${out}/compare-${backend}-${tier}.png`, PNG.sync.write(sheet));
}
