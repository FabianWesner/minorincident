/** Q-236 real-level start camera and roadside evac-flood capture. Run via e2e-lock. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.R1_OUT ?? 'test-results/l10-r1';
const session = new SceneSession({ backend: 'webgl2', tier: 'high', seed: 32 });
mkdirSync(out, { recursive: true });
try {
  await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L10', { seed: 32 }); a.pause(); a.cheats.god(true); a.missions.begin();
    await a.step(1);
  });
  const rows: unknown[] = [];
  for (const [name, x, z, zoom] of [['start', 547, 0, 1], ['start-verge', 551.5, 4.5, 1], ['start-6m', 553, 0, 1], ['start-10m', 557, 0, 1], ['flood', 666, 25, 1.5]] as const) {
    rows.push(await session.page.evaluate(async ({ name, x, z, zoom }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      a.teleport(1, { x, z }); const p = game.world.entities.get(1)!.transform, rig = game.view.view;
      rig.inspectionPose = null; rig.reset(p); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true); rig.update(p, 0);
      await a.step(1); await a.screenshotReady();
      return { name, at: p, camera: rig.getState(), backend: a.perf().backend };
    }, { name, x, z, zoom }));
    await session.page.screenshot({ path: `${out}/${name}.png` });
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
  console.log(JSON.stringify({ out, errors: session.errors }));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
