import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { l6InjuryLines } from '../../src/data/l6';

const out = 'test-results/s182-l6-speaker'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { ui: '1' } });
try {
  await session.open();
  await session.page.addStyleTag({ content: '.story-bubble { visibility: visible !important; }' });
  const setup = await session.page.evaluate(async line => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L6', { seed: 1, progression: 'L6-default' }); api.pause(); api.missions.begin(); api.cheats.god(true); api.camera.zoom(1.5);
    const m = game.world.missions!, row = m.state.l6!.survivors.find(s => s.key === 'rosa' || s.routine === 'treat')!, actor = game.world.entities.get(row.id)!;
    api.teleport(1, { x: actor.transform.x - 2.5, z: actor.transform.z }); api.camera.follow(); game.view.view.reset(game.world.entities.get(1)!.transform);
    (m.l6 as unknown as { say: (id: number, text: string) => void }).say(row.id, line);
    await api.step(1);
    return { id: row.id, routine: row.routine, story: actor.civilian?.story?.clip, at: { x: actor.transform.x, z: actor.transform.z } };
  }, l6InjuryLines.treatment);
  const frames: { frame: number; jpeg: Buffer }[] = [], actors: unknown[] = [], bubbles: unknown[] = [];
  for (let i = 0; i < 4; i++) {
    await session.page.evaluate(() => window.__SS__!.step(60)); frames.push({ frame: i, jpeg: await session.snapshot() });
    writeFileSync(`${out}/frame-${i}.jpg`, frames[i].jpeg);
    actors.push(await session.page.evaluate(id => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const actor = game.world.entities.get(id)!;
      return { projection: game.view.project(actor.transform.x, actor.transform.y + .5, actor.transform.z), figures: game.view.labProbes().npcs?.snapshot().civilians.figures.filter(figure => figure.id === id) };
    }, setup.id));
    bubbles.push(await session.page.evaluate(() => {
      const bubble = document.querySelector<HTMLElement>('.story-bubble');
      return bubble && { hidden: bubble.hidden, text: bubble.textContent, opacity: getComputedStyle(bubble).opacity, visibility: getComputedStyle(bubble).visibility };
    }));
  }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, actors, bubbles, errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
