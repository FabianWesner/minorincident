/** Q242 matching cure mist captures; run through the shared browser wrapper. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const tier = (process.env.MIST_TIER ?? 'low') as 'low' | 'high';
const out = process.env.MIST_OUT ?? `test-results/q242/review-${tier}`;
const backend = (process.env.MIST_BACKEND ?? 'webgl2') as 'webgl2' | 'webgpu';
const session = new SceneSession({ backend, tier, query: { loadProfile: '2' } });
mkdirSync(out, { recursive: true });
const builds = () => session.page.evaluate(() => ({ ...window.__SS__!.perf().nodeBuildMaterials }));
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const wide = readSpec('tests/scenes/catalog/qa-l10-epilogue.json');
  wide.camera = { mode: 'game', target: 'courier', zoom: tier === 'low' ? 1.5 : 1 };
  await session.load(wide);
  await session.ready();
  const loaded = await builds();
  await session.step(720);
  await session.screenshot(`${out}/wide-126s.png`);
  const warm = await builds();
  await session.step(720);
  await session.screenshot(`${out}/wide-138s.png`);
  await session.step(840);
  await session.screenshot(`${out}/title.png`);
  await session.step(300);
  await session.screenshot(`${out}/credits.png`);
  const after = await builds();
  const metrics = await session.metrics();
  const close = readSpec('tests/scenes/catalog/qa-l10-epilogue.json');
  close.infectedCap = 200;
  close.cureProgression!.epilogueElapsed = 0;
  close.script = [];
  close.actors![0].at = [4002, -27];
  close.camera = { mode: 'game', target: 'courier', zoom: 1.5 };
  await session.load(close);
  const spawned = await session.page.evaluate(() => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    a.cheats.god(true);
    const ids: number[] = [];
    for (let i = 0; i < 72; i++) {
      const angle = i * 2.3999632297, r = 2 + Math.sqrt(i / 72) * 6;
      const cell = w.infected!.nav.nearestCell(4002 + Math.cos(angle) * r, -27 + Math.sin(angle) * r, .35);
      if (cell >= 0) ids.push(a.spawn('infected.runner', { x: w.infected!.nav.x(cell), z: w.infected!.nav.z(cell) }, { state: 'chase' }));
    }
    return ids.length;
  });
  await session.step(1800);
  await session.screenshot(`${out}/corpse-close.png`);
  await session.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.view.vfx!.blasts.visible = false; });
  await session.screenshot(`${out}/corpse-close-no-mist.png`);
  const evidence = { tier, backend, spawned, loaded, warm, after, lateBuilds: Object.entries(after).filter(([key, value]) => value > (warm[key] ?? 0)), mistBuildsAfterLoad: Object.entries(after).filter(([key, value]) => key.includes('e27-blasts') && value > (loaded[key] ?? 0)), metrics, errors: session.errors };
  writeFileSync(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ out, tier, backend, spawned, lateBuilds: evidence.lateBuilds, mistBuildsAfterLoad: evidence.mistBuildsAfterLoad, errors: session.errors }));
  if (!Object.keys(loaded).length || evidence.lateBuilds.length || evidence.mistBuildsAfterLoad.length || metrics.backend !== backend || session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
