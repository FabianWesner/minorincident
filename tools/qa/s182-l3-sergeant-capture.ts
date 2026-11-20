import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'test-results/s182-l3-sergeant'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { ui: '1' } });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const setup = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L3', { seed: 1, progression: 'L3-default' }); api.missions.begin(); api.pause(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.step(1);
    const m = game.world.missions!, player = game.world.entities.get(1)!.transform;
    return { phase: m.state.l3!.phase, tick: game.world.tick, player: { ...player }, crew: m.state.l3!.squadIds.map(id => ({ id, ...game.world.entities.get(id)!.transform })) };
  });
  const frames: { frame: number; jpeg: Buffer }[] = [], samples: { tick: number; subtitle?: string; positions: [number, unknown][]; figures: { id: number; clip: string; drawn: boolean }[] }[] = [];
  for (let i = 0; i < 9; i++) {
    await session.page.evaluate(() => window.__SS__!.step(60));
    const jpeg = await session.snapshot();
    const sample = await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const civilians = game.view.labProbes().npcs!.snapshot().civilians.figures;
      const positions = (game.view.labProbes().npcs as unknown as { civilians: { conversationPositions: Map<number, unknown> } }).civilians.conversationPositions;
      return { tick: game.world.tick, subtitle: game.world.missions!.state.subtitle?.id, positions: [...positions.entries()], figures: civilians };
    });
    samples.push(sample);
    if (sample.subtitle === 'L3.sergeant') frames.push({ frame: i, jpeg });
  }
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, samples, errors: session.errors }, null, 2));
  const lines = samples.filter(sample => sample.subtitle === 'L3.sergeant');
  const actor = lines[0]?.positions[0]?.[0];
  if (!actor || lines.some(sample => !sample.figures.some(figure => figure.id === actor && figure.drawn))) throw new Error('Sergeant not drawn during the line');
  if (!lines.some(sample => sample.figures.some(figure => figure.id === actor && figure.clip !== 'idle'))) throw new Error('Sergeant did not gesture');
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, samples, errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
