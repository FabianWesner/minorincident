import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/s182-hangar-motion'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', seed: 32 });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const cast = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' });
    if (game.world.missions?.state.phase === 'briefing') api.missions.begin();
    api.cheats.god(true); api.teleport(1, { x: 2707, z: 66 }); api.camera.follow(); api.camera.zoom(1.5); api.pause(); api.debug.figureJoints(true);
    const m = game.world.missions!; m.state.states['story-initialized'] = true; m.state.states['sam-alive'] = true;
    while (m.state.steps.research.status !== 'active') m.completeObjective();
    m.state.counters['hangar-line'] = 4; m.state.counters['hangar-line-ticks'] = 0; m.state.subtitle = null;
    for (let i = 0; i < 10; i++) { await api.step(60); await api.screenshotReady(); }
    m.state.counters['hangar-line'] = 5; m.state.counters['hangar-line-ticks'] = 0; m.state.subtitle = null; await api.step(1);
    return { actors: { ...m.state.actors }, subtitle: m.state.subtitle as { id: string } | null };
  });
  type Figure = { drawn: boolean; clip: string; phase: number; joints?: Record<string, number[]>; forward?: number[] };
  const frames: { frame: number; jpeg: Buffer }[] = [], samples: Record<string, Figure | undefined>[] = [];
  for (let i = 0; i < 8; i++) {
    await session.page.evaluate(() => window.__SS__!.step(30));
    const jpeg = await session.snapshot(); frames.push({ frame: i, jpeg });
    samples.push(await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, ids = game.world.missions!.state.actors;
      const figures = game.view.labProbes().npcs!.snapshot().civilians.figures;
      return Object.fromEntries(['ruiz', 'researcher', 'guard-west', 'guard-east'].map(name => [name, figures.find(f => f.id === ids[`hangar-${name}`])]));
    }));
  }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ cast, samples, errors: session.errors }, null, 2));
  const ruiz = samples.map(s => s.ruiz);
  if (cast.subtitle?.id !== 'L10.ruiz' || ruiz.some(f => !f?.drawn || !f.joints?.handL)) throw new Error('Ruiz was not drawn during his line');
  const start = ruiz[0]!.joints!.handL;
  if (!ruiz.some(f => Math.hypot(...f!.joints!.handL.map((value, i) => value - start[i])) > .1)) throw new Error('Ruiz did not move his hand');
  for (const name of ['researcher', 'guard-west', 'guard-east']) {
    if (samples.some(s => !s[name]?.drawn)) throw new Error(`${name} was not drawn`);
    if (!samples.some(s => s[name]!.phase !== samples[0][name]!.phase)) throw new Error(`${name} did not animate`);
  }
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
