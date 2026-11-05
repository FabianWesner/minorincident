import { resolve } from 'node:path';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SceneSession, stopServer, writeJson } from './session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const phase = process.argv[2] === 'before' ? 'before' : 'after';
const out = resolve(`test-results/luna-fixes-1101/fog-${phase}`);
mkdirSync(out, { recursive: true });
const baseline = resolve('src/render/__luna_before_PaletteMaterial.ts');
if (phase === 'before') writeFileSync(baseline, execFileSync('git', ['show', '0e3e33219:src/render/PaletteMaterial.ts']));
const matrix: { index: number; backend: 'webgpu' | 'webgl2'; tier: 'low' | 'high'; scene: 'L1-day' | 'L5-fog' | 'L8-night'; zoom: 1.5 | .5 }[] = [];
let index = 0;
try {
for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
  const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, seed: 1 });
  try {
    await session.open();
    if (phase === 'before') {
      await session.page.route('**/src/render/PaletteMaterial.ts*', async route => {
        const response = await route.fetch({ url: route.request().url().replace('/PaletteMaterial.ts', '/__luna_before_PaletteMaterial.ts') });
        await route.fulfill({ response });
      });
      await session.page.reload();
      await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
      await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    }
    for (const scene of ['L1-day', 'L5-fog', 'L8-night'] as const) {
      const spec: SceneSpec = {
        name: `luna-fog-${scene}-${backend}-${tier}`, ground: 'asphalt', size: 24, dof: false,
        time: scene === 'L1-day' ? 'L1' : scene === 'L5-fog' ? 'L5' : 'L8-zoo',
        weather: scene === 'L1-day' ? 'clear' : scene === 'L5-fog' ? 'fog' : 'none',
        actors: [
          { id: 'courier', kind: 'courier', at: [0, 0], yaw: 0 },
          { id: 'corgi', kind: 'corgi', at: [1, 0], yaw: 0 },
        ],
        camera: { mode: 'game', target: 'courier', zoom: 1.5 }, frames: 1,
      };
      await session.load(spec);
      for (const zoom of [1.5, .5] as const) {
        await session.page.evaluate(z => window.__SCENE__!.setCamera({ mode: 'game', target: 'courier', zoom: z }), zoom);
        await session.ready();
        await session.page.screenshot({ path: resolve(out, `${backend}-${tier}-${scene}-z${zoom}.jpg`), type: 'jpeg', quality: 82 });
        matrix.push({ index, backend, tier, scene, zoom }); index++;
      }
    }
    if (session.errors.length) throw new Error(session.errors.join('\n'));
    console.log(`${phase} ${backend} ${tier} captured`);
  } finally { await session.close(); }
}
writeJson(resolve(out, 'matrix.json'), matrix);
} finally { if (phase === 'before') unlinkSync(baseline); stopServer(); }
