/** Production L10 follow-camera budgets, post-warm-up builds and diagnostic contrast. Shared headless pool. */
import assert from 'node:assert/strict';
import type { Game } from '../../src/Game';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import { measureContrast } from '../scenelab/contrast';
const tier = (process.argv[2] ?? 'high') as 'high' | 'low';
const backend = (process.argv[3] ?? 'webgl2') as Backend;
const session = new SceneSession({ tier, backend, query: { loadProfile: '1' }, viewport: { width: 1280, height: 720 } });
const rows: unknown[] = [], failures: string[] = [], out = `test-results/q246/${backend}-${tier}`;
mkdirSync(out, { recursive: true });
try {
  await session.open();
  await session.page.evaluate(async () => {
    await window.__SS__!.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' });
    const a = window.__SS__!; if (a.missions.state()?.phase === 'briefing') a.missions.begin();
    a.pause(); a.cheats.god(true); a.camera.follow(); await a.screenshotReady();
  });
  await session.page.evaluate(() => {
    const renderer = (window.__SCENE__ as unknown as { game: Game }).game.view.renderer;
    const before = renderer.debug.onNodeBuilderCreated;
    const late: unknown[] = [];
    (window as unknown as { q246Builds: unknown[] }).q246Builds = late;
    renderer.debug.onNodeBuilderCreated = (builder, object) => {
      before?.(builder, object);
      const draw = object as unknown as { object: import('three').Object3D; material: import('three').Material };
      const ancestry: unknown[] = [];
      for (let n: import('three').Object3D | null = draw.object; n; n = n.parent) ancestry.push({ name: n.name, asset: n.userData.assetId });
      late.push({ ancestry, material: draw.material.name, type: draw.material.type });
    };
  });
  const warm = await session.page.evaluate(() => ({ ...window.__SS__!.perf().nodeBuildMaterials }));
  assert.ok(Object.keys(warm).length > 0, 'loadProfile must populate shader build counters');
  for (const [name, x, z] of [['r1-crash',552,4],['r1-verge',640,8],['r2-security',782,30],['r2-detour',930,80],['r3-depot',1300,40],['r3-yard',1560,100],['r4-post',1880,25],['r4-breach',2150,-75],['r5-entry',2530,20],['r5-terminal',2700,45]] as const) {
    await session.page.evaluate(async ({ x, z }) => { const a = window.__SS__!; a.teleport(1, { x, z }); a.camera.follow(); await a.step(240); }, { x, z });
    for (const zoom of [1, 1.5]) {
      await session.page.evaluate(async zoom => { window.__SS__!.camera.zoom(zoom); await window.__SS__!.step(45); await window.__SS__!.screenshotReady(); }, zoom);
      const trace = await session.page.evaluate(() => (window as unknown as { q246Builds: unknown[] }).q246Builds);
      const perf = await session.page.evaluate(() => { const f = window.__SS__!.perf(); return { draws: f.drawCalls, triangles: f.triangles, lighting: f.lighting, builds: { ...f.nodeBuildMaterials } }; });
      const contrast = await measureContrast(session.page, { name, contrast: { district: 'D-CURE', halfWidthM: 3, stepM: 2 } });
      const lateBuilds = Object.entries(perf.builds).filter(([key, n]) => n > (warm[key] ?? 0));
      rows.push({ name, zoom, ...perf, lateBuilds, trace, contrast });
      await session.screenshot(`${out}/${name}-z${zoom}.png`);
      writeFileSync(`${out}/checks.json`, JSON.stringify({ tier, warm, rows, errors: session.errors }, null, 2));
      console.log(JSON.stringify({ name, zoom, draws: perf.draws, triangles: perf.triangles, contrast: contrast?.median, lateBuilds }));
      if (perf.draws > 300 || perf.triangles > 500_000) failures.push(`${name}/${zoom}: budget`);
      if (lateBuilds.length) failures.push(`${name}/${zoom}: late shader builds`);
    }
  }
  writeFileSync(`${out}/checks.json`, JSON.stringify({ tier, warm, rows, errors: session.errors }, null, 2));
  assert.deepEqual(session.errors, []);
  assert.deepEqual(failures, []);
} finally { await session.close(); stopServer(); }
