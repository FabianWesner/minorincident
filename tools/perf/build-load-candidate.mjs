// Build off the shared Mac while browser timing reservations are queued.
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const files = ['src/Game.ts', 'src/render/GameView.ts', 'src/render/CrowdView.ts', 'src/render/PreRenderer.ts'];
const sources = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const sourceHash = createHash('sha256').update(JSON.stringify(sources)).digest('hex');
const outDir = process.env.LOAD_BUILD_OUT ?? 'test-results/load-stalls/population-candidate';
await build({ configLoader: 'runner', define: { __BUILD_COMMIT__: JSON.stringify(`load-${sourceHash.slice(0, 12)}`) }, build: { outDir, sourcemap: 'hidden' } });
writeFileSync(`${outDir}/load-build.json`, JSON.stringify({ sourceHash, sources }, null, 2) + '\n');
