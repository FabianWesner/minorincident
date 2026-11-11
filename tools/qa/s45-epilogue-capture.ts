/** Capture the L10 epilogue fixture at both framing scales and quality/backend combinations. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../../src/sim/progression/Save';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
const backend = process.env.S45_BACKEND as 'webgl2' | 'webgpu';
const tier = process.env.S45_TIER as 'low' | 'high';
const zoom = Number(process.env.S45_ZOOM ?? 1);
const label = process.env.S45_LABEL ?? 'after';
const out = `test-results/s45-epilogue/${label}/${backend}-${tier}-z${zoom}`;
mkdirSync(out, { recursive: true });
const raw = JSON.parse(gunzipSync(readFileSync('tests/fixtures/saves/qa/l10-dispersal-console.json.gz')).toString()).campaign;
const decoded = decodeSave(JSON.stringify(raw));
if (decoded.status !== 'ok') throw new Error('Fixture does not decode');
const saved = decoded.save;
saved.settings.quality = tier;
const session = new SceneSession({ backend, tier, query: { loadProfile: '2' } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async ({ saved, zoom }) => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    game.campaign = saved; await game.loadLevel('L10'); window.__SS__!.pause();
    window.__SS__!.camera.zoom(zoom);
    const m = game.world.missions!;
    m.begin(); m.loadCheckpoint('cure-disperse-ready');
    m.state.states['cure-released'] = true;
    m.state.steps.release.status = 'completed'; m.state.steps.epilogue.status = 'active';
    m.l10!.cure.release(); m.state.cureFront!.elapsed = 46 * 60;
    m.l10!.epilogue.update();
  }, { saved, zoom });
  await session.page.evaluate(() => window.__SS__!.step(120));
  await session.screenshot(`${out}/closing.png`);
  await session.page.evaluate(() => window.__SS__!.step(60));
  await session.screenshot(`${out}/closing-late.png`);
  await session.page.evaluate(() => window.__SS__!.step(540));
  await session.screenshot(`${out}/pullout-mid.png`);
  await session.page.evaluate(() => window.__SS__!.step(360));
  await session.screenshot(`${out}/pullout-end.png`);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ backend, tier, zoom, actual: await session.page.evaluate(() => window.__SS__!.perf().backend), errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
