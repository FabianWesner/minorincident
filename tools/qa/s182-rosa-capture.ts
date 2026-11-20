import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../../src/sim/progression/Save';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const decoded = decodeSave(JSON.stringify(JSON.parse(gunzipSync(readFileSync('tests/fixtures/saves/qa/l10-dispersal-console.json.gz')).toString()).campaign));
if (decoded.status !== 'ok') throw new Error('Invalid fixture');
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { loadProfile: '2' } });
const out = 'test-results/s182-rosa'; mkdirSync(out, { recursive: true });
try {
  await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  await session.page.evaluate(async saved => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game, api = window.__SS__!;
    saved.crossingHandover!.shelteredPassengers.push({ id: 90001, kind: 'civilian', transform: { x: 0, y: .7, z: 0, yaw: 0 }, health: { current: 100, max: 100 }, civilian: { model: 'npc.rosa.aftermath', survivor: { key: 'rosa' } } } as never);
    game.campaign = saved; await game.loadLevel('L10'); api.pause();
    const m = game.world.missions!; m.begin(); m.loadCheckpoint('cure-disperse-ready');
    m.state.states['cure-released'] = true; m.state.steps.release.status = 'completed'; m.state.steps.epilogue.status = 'active';
    m.l10!.cure.release(); m.state.cureFront!.elapsed = 30 * 60; m.l10!.epilogue.update();
    await api.step(1);
  }, decoded.save);
  await session.page.waitForFunction(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    return ((game.view as unknown as { endingView?: { readyShots: number } }).endingView?.readyShots ?? 0) >= 6;
  }, null, { timeout: 120_000 });
  const frames: { frame: number; jpeg: Buffer }[] = [];
  for (let i = 0; i < 4; i++) {
    await session.page.evaluate(() => window.__SS__!.step(45));
    frames.push({ frame: i, jpeg: await session.snapshot() });
    writeFileSync(`${out}/frame-${i}.jpg`, frames[i].jpeg);
  }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 640, 360);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
