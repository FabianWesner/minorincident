/** Game-camera campaign audit. Run after build, under tools/e2e-lock.sh with a private SCENE_PORT. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { SceneSession, stopServer, port, origin, type Backend } from '../scenelab/session';

const phase = process.argv[2] ?? 'before', backend = (process.argv[3] ?? 'webgl2') as Backend;
const root = `${process.env.ATMOSPHERE_OUT ?? 'docs/reports/atmosphere'}/${phase}/${backend}`;
const zooms = (process.env.ATMOSPHERE_ZOOMS ?? '0.5,1,1.5').split(',').map(Number);
const tiers = (process.env.ATMOSPHERE_TIERS ?? 'high,low').split(',') as ('high' | 'low')[];
const levels = (process.env.ATMOSPHERE_LEVELS ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const rows: object[] = [];
const look = JSON.parse(process.env.ATMOSPHERE_LOOK ?? '{}') as Record<string, Record<string, string | number>>;
let baselineServer: ReturnType<typeof spawn> | undefined;
try {
  if (process.env.ATMOSPHERE_BASELINE_DIST) {
    if (await fetch(origin).then(() => true, () => false)) throw new Error(`Baseline port ${port} is occupied`);
    baselineServer = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--outDir', process.env.ATMOSPHERE_BASELINE_DIST, '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
    const deadline = Date.now() + 30_000;
    while (!await fetch(origin).then(r => r.ok, () => false)) {
      if (Date.now() > deadline) throw new Error('Baseline preview failed to start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  for (const tier of tiers) {
    const session = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 } });
    try {
      await session.open();
      for (const n of levels) {
        const level = `L${n}`;
        try {
          await session.page.evaluate(async ({ level, look }) => {
            const api = window.__SS__!;
            await api.loadLevel(level, { seed: 1 }); api.pause(); api.cheats.god(true);
            api.settings.set({ cameraShake: false });
            const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
            // Keep the real follow rig, bypassing only the opening cinematic for this still audit.
            game.view.view.follow(); game.view.view.pull(0, 0, 0);
            // Tuning aid: ATMOSPHERE_LOOK applies a live look patch per level ({"L1": {...worldLook keys}}).
            if (look[level]) game.view.setLook({ version: 1, worldLook: look[level], palette: {} });
            for (let i = 0; i < 4; i++) game.view.update(1);
            await api.screenshotReady();
          }, { level, look });
          await session.page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility: hidden !important; }' });
          for (const zoom of zooms) {
            const state = await session.page.evaluate(async zoom => {
              const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
              const rig = game.view.view, target = { x: rig.focus.x, y: rig.focus.y + .72, z: rig.focus.z }, driving = rig.driving, convoy = rig.convoy;
              rig.reset(target); rig.driving = driving; rig.convoy = convoy;
              rig.zoom(Math.log(zoom), true); rig.update(target, 0);
              for (let i = 0; i < 4; i++) game.view.update(1);
              await window.__SS__!.screenshotReady();
              const { backend, quality, camera, lighting, postFx } = window.__SS__!.getState().render;
              const p = window.__SS__!.perf();
              return { render: { backend, quality, camera, postFx, lighting: lighting && {
                preset: lighting.preset, intensity: lighting.intensity, sky: lighting.sky, fogColors: lighting.fogColors,
                fogNear: lighting.fogNear, fogFar: lighting.fogFar, shadowColor: lighting.shadowColor,
              } }, perf: { backend: p.backend, drawCalls: p.drawCalls, triangles: p.triangles, geometries: p.geometries,
                textures: p.textures, heapBytes: p.heapBytes, paused: p.paused, contextLost: p.contextLost } };
            }, zoom);
            const file = `${root}/${level}-${tier}-z${zoom}.jpg`; mkdirSync(root, { recursive: true });
            await session.page.locator('canvas').first().screenshot({ path: file, type: 'jpeg', quality: 85 });
            rows.push({ level, tier, zoom, file, ...state });
          }
          console.log(`${phase} ${backend} ${tier} ${level}: captured`);
        } catch (error) { rows.push({ level, tier, error: String(error) }); console.error(`${level}: ${error}`); }
      }
      if (session.errors.length) rows.push({ tier, errors: session.errors });
    } finally { await session.close(); }
  }
} finally { stopServer(); baselineServer?.kill(); mkdirSync(root, { recursive: true }); writeFileSync(`${root}/index.json`, JSON.stringify(rows, null, 2) + '\n'); }
if (rows.some(row => 'error' in row || 'errors' in row)) process.exitCode = 1;
