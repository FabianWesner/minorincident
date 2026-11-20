import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/s182-l8-hale'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { ui: '1' } });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const setup = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L8', { seed: 1, progression: 'L8-default' }); api.missions.begin(); api.pause(); api.cheats.god(true); api.camera.zoom(1.5);
    const m = game.world.missions!, s = m.l8!.state, hale = game.world.entities.get(s.haleId)!;
    api.teleport(1, { x: hale.transform.x - 3, z: hale.transform.z }); api.camera.follow();
    m.state.states['hale-keys'] = true; hale.civilian!.story = { clip: 'npc-give', start: game.world.tick - 24 };
    hale.civilian!.knockedUntil = game.world.tick + 120; s.haleFallAt = game.world.tick + 120;
    const shot = m.def.cinematics['l8-hale']; shot.target = [hale.transform.x, 1, hale.transform.z]; shot.position = [hale.transform.x + 16, 12, hale.transform.z + 18];
    m.radio('L8.hale-dying'); m.cinematic('l8-hale'); await api.step(1);
    return { id: hale.id, at: { ...hale.transform } };
  });
  const frames: { frame: number; jpeg: Buffer }[] = [], samples: { tick: number; health: number; figures: { clip: string; drawn: boolean }[] }[] = [];
  for (let i = 0; i < 10; i++) {
    await session.page.evaluate(() => window.__SS__!.step(30));
    frames.push({ frame: i, jpeg: await session.snapshot() });
    samples.push(await session.page.evaluate(id => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      return { tick: game.world.tick, health: game.world.entities.get(id)!.health.current, figures: game.view.labProbes().npcs!.snapshot().civilians.figures.filter(f => f.id === id) };
    }, setup.id));
  }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, samples, errors: session.errors }, null, 2));
  if (!samples.some(s => s.health > 0 && s.figures.some(f => f.drawn && f.clip === 'npc-give'))) throw new Error('Hale did not present the handoff');
  if (!samples.some(s => s.health <= 0)) throw new Error('Hale did not fall');
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
