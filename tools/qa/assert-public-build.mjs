import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const files = readdirSync('dist', { recursive: true }).map(String).filter(path => /\.(?:js|html)$/.test(path));
assert(files.includes('index.html'), 'public build must contain dist/index.html');
const artifact = files.map(path => readFileSync(`dist/${path}`, 'utf8')).join('\n');
for (const marker of ['__SS__', '__SCENE__', '__MOTIONLAB__', '__ASSET__', 'testApi', 'SceneLab', 'MotionLab'])
  assert(!artifact.includes(marker), `public build unexpectedly emits QA marker ${marker}`);
console.log(`[public-build] PASS: ${files.length} HTML/JS files contain no QA hooks`);
