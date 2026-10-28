import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

/** Actual L6 exit after staging the surviving column at the platform; real mouse movement input. */
const out = process.argv[2] ?? 'test-results/polish-26/l6-exit';
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  await session.page.evaluate(async baseline => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1, progression: 'L6-default' });
    a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1);
    a.missions.begin();
    for (const id of ['shelter', 'stop', 'retreat']) a.missions.completeObjective(id);
    const g = (window.__SCENE__ as unknown as { game: Game }).game, s = g.world.missions!.state.l6!;
    if (baseline) Object.assign(g.world.missions!.def.cinematics.night, { position: [299, 39, 42], target: [273, 3.9, 16] });
    s.leaderX = 248; s.leaderZ = 15;
    s.survivors.forEach((r, i) => {
      r.status = 'following'; r.straggler = false; r.collected = false; r.rejoined = true;
      const e = g.world.entities.get(r.id)!; e.hidden = false;
      a.teleport(r.id, { x: 245 - Math.floor(i / 3) * 1.4, z: 15 + (i % 3 - 1) * .725 });
    });
    const player = g.world.entities.get(1)!;
    player.transform = { ...player.transform, x: 264, y: 4.62, z: 15.9 };
    g.world.physics.playerBody!.setTranslation(player.transform, true);
  }, process.argv[3] === 'baseline');
  const trace = [];
  for (let second = 0; second < 90; second++) {
    const sample = await session.page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, a = window.__SS__!;
      const p = a.getEntity(1)!.transform, s = a.missions.state();
      return { tick: g.world.tick, p, phase: s?.phase, l6: s?.l6, cinematic: s?.cinematic,
        projected: a.camera.project(265, 3.9, 15.9) };
    });
    trace.push(sample);
    if (second % 10 === 0 || sample.cinematic) { await session.page.evaluate(() => window.__SS__!.screenshotReady()); await session.screenshot(`${out}/second-${second}.png`); }
    if (sample.cinematic) {
      await session.page.evaluate(() => window.__SS__!.step(120));
      await session.screenshot(`${out}/ending.png`); break;
    }
    const [x, y] = sample.projected;
    await session.page.mouse.move(Math.max(40, Math.min(1240, (x + 1) * 640)), Math.max(40, Math.min(680, (1 - y) * 360)));
    await session.page.mouse.down(); await session.page.evaluate(() => window.__SS__!.step(3)); await session.page.mouse.up();
    await session.page.evaluate(() => window.__SS__!.step(57));
  }
  writeJson(`${out}/trace.json`, { trace, consoleErrors: session.errors }); console.log(JSON.stringify(trace.at(-1)));
} finally { await session.close(); stopServer(); }
