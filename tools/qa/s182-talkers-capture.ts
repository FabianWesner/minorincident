import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'docs/reports/s182-talkers';
mkdirSync(out, { recursive: true });
mkdirSync('test-results/s182-talkers', { recursive: true });
const rows: unknown[] = [];
for (const tier of ['high', 'low'] as const) {
  const session = new SceneSession({ backend: 'webgl2', tier, seed: 32, viewport: { width: 1280, height: 720 } });
  try {
    await session.open();
    await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
    await session.page.evaluate(async () => {
      const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      await api.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' });
      if (game.world.missions?.state.phase === 'briefing') api.missions.begin();
      api.cheats.god(true); api.teleport(1, { x: 2707, z: 66 }); api.camera.follow(); api.pause();
      const mission = game.world.missions!;
      mission.state.states['story-initialized'] = true;
      mission.state.states['sam-alive'] = true;
      while (mission.state.steps.research.status !== 'active') mission.completeObjective();
      await api.step(20);
      const camera = game.view.view, player = game.world.entities.get(1)!.transform;
      camera.zoom(Math.log(1.5 / camera.getState().targetZoom), true); camera.update(player, 0);
    });

    const captureTalk = async (id: string, speaker: 'voss' | 'sam' | 'ruiz', line: number, count = 6) => {
      await session.page.evaluate(async ({ speaker, line }) => {
        const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game, mission = game.world.missions!;
        {
          mission.state.counters['hangar-line'] = speaker === 'sam' ? 6 : speaker === 'ruiz' ? 4 : 0; mission.state.counters['hangar-line-ticks'] = 0;
          mission.state.subtitle = null;
          for (let i = 0; i < 10; i++) { await api.step(60); await api.screenshotReady(); }
        }
        mission.state.counters['hangar-line'] = line; mission.state.counters['hangar-line-ticks'] = 0;
        mission.state.subtitle = null;
        await api.step(1);
        const subtitle = mission.state.subtitle as { id: string } | null;
        if (!subtitle || !subtitle.id.startsWith(speaker === 'voss' ? 'L10.voss-' : speaker === 'sam' ? 'L10.sam-' : 'L10.ruiz')) throw new Error(`unexpected subtitle ${subtitle?.id}`);
        const actorId = mission.state.actors[`hangar-${speaker}`];
        if (!actorId) throw new Error(`missing hangar speaker ${speaker}`);
        api.camera.follow();
      }, { speaker, line });
      const frames: Buffer[] = [];
      for (let i = 0; i < count; i++) {
        await session.page.evaluate(ticks => window.__SS__!.step(ticks), i === 0 ? 0 : 72);
        const displayed = await session.page.locator('.mission-subtitle').isVisible();
        if (!displayed) throw new Error(`subtitle is not visible for ${id}, frame ${i}`);
        const image = await session.snapshot();
        if (tier === 'high' && speaker === 'voss') writeFileSync(`test-results/s182-talkers/voss-${i}.jpg`, image);
        frames.push(image);
      }
      await session.makeSheet(frames.map((jpeg, frame) => ({ frame, jpeg })), `${out}/${id}-${tier}.jpg`, 420, 240);
      rows.push({ id, tier, speaker, files: `${id}-${tier}.jpg`, frames: count, spanSeconds: (count - 1) * 1.2, zoom: 1.5, errors: session.errors.length });
    };

    await captureTalk('voss-talking', 'voss', 4, tier === 'high' ? 6 : 1);
    if (tier === 'high') await captureTalk('ruiz-talking', 'ruiz', 5, 4);
    await captureTalk('sam-delivery', 'sam', 9, 4);
  } finally { await session.close(); stopServer(); }
}
writeFileSync(`${out}/capture.json`, JSON.stringify({ rows, errors: [] }, null, 2) + '\n');
console.log(JSON.stringify(rows));
