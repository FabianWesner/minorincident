/** SCENE_PORT=<unique> SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/vfx-stunning.ts before|after
 * Fixed game cameras, both backends/tiers, and the two required zooms. Build before browser admission.
 * VFX_BACKEND, VFX_TIERS (high,low), VFX_ZOOMS (1.5,1,.5) and VFX_FILTER restrict a batch; VFX_OUT names the test-results folder; no quiet/native frame-time claims from these CPU timings. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson, port, origin } from './session';
import { runSpec } from './run';

const phase = process.argv[2];
if (phase !== 'before' && phase !== 'after') throw new Error('Expected before or after');
const root = `test-results/${process.env.VFX_OUT ?? 'vfx-stunning'}/${phase}`, results = [];
const files = readdirSync('tests/scenes/catalog').filter(f => f.startsWith('vfx-') && f.endsWith('.json') && (!process.env.VFX_FILTER || new RegExp(process.env.VFX_FILTER).test(f))).sort();
let preview: ChildProcess | undefined;
try {
  // An immutable baseline build can be served while dist/ contains the new implementation.
  if (process.env.VFX_DIST) {
    preview = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--outDir', resolve(process.env.VFX_DIST), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      try { ready = (await fetch(origin)).ok; } catch { /* Server is still starting. */ }
      if (!ready) await new Promise(r => setTimeout(r, 500));
    }
    if (!ready) throw new Error('VFX preview did not start');
  }
  for (const backend of ['webgl2', 'webgpu'] as const) {
    if (process.env.VFX_BACKEND && process.env.VFX_BACKEND !== backend) continue;
    for (const tier of ['high', 'low'] as const) {
      if (process.env.VFX_TIERS && !process.env.VFX_TIERS.split(',').includes(tier)) continue;
      const session = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 } });
      try {
        await session.open();
        for (const file of files) for (const zoom of (process.env.VFX_ZOOMS ?? '1,.5').split(',').map(Number)) {
          const spec = readSpec(`tests/scenes/catalog/${file}`), name = `${spec.name}@${backend}-${tier}-z${zoom}`;
          spec.camera = { mode: 'game', target: [0, 0], zoom };
          const result = await runSpec(session, spec, { file, out: `${root}/${name}`, shots: [], sheet: spec.sheet });
          results.push({ ...result, name });
          const index = `${root}/index-${backend}.json`;
          const previous: typeof results = existsSync(index) ? JSON.parse(readFileSync(index, 'utf8')) : [];
          writeJson(index, [...new Map([...previous, ...results].filter(r => r.name.includes(`@${backend}-`)).map(r => [r.name, r])).values()]);
          writeJson(`${root}/${name}/feedback.json`, await session.page.evaluate(() => {
            const lab = window.__SCENE__ as unknown as { game: import('../../src/Game').Game; perf: { stepMs: number }[] };
            const game = lab.game;
            return { cpuFrames: lab.perf.map(p => p.stepMs), effects: game.view.vfx?.snapshot(), events: game.world.events.events(0).filter(e => e.type === 'combat.hit' || e.type === 'combat.kill' || e.type === 'vehicle.durability-hit') };
          }));
          console.log(`${result.pass ? 'pass' : 'FAIL'} ${name} ${result.seconds.toFixed(1)}s ${JSON.stringify(result.failed)}`);
        }
      } finally { await session.close(); }
    }
  }
} finally { stopServer(); preview?.kill(); }
if (results.some(r => !r.pass)) process.exitCode = 1;
