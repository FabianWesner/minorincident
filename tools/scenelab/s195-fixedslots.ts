import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer } from './session';
import type { Game } from '../../src/Game';

const out = resolve('test-results/s195-fixedslots'); mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  const cells: { frame: number; jpeg: Buffer }[] = [];
  for (const level of ['L4', 'L8', 'L10'] as const) {
    await session.page.goto(`http://127.0.0.1:${process.env.SCENE_PORT ?? 5146}/?test=1&ui=1&scenelab=1&debug=true&inspect=1&level=${level}&bot=ghost&renderer=webgl&profile=1&audio=muted&quality=high&seed=1`);
    await session.page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    await session.page.evaluate(async () => { await window.__SS__!.ready; });
    await session.page.evaluate(async () => {
      const a = window.__SS__!; a.pause(); a.cheats.god(true); a.missions.begin(); a.camera.follow(); a.camera.zoom(1);
      a.inspect.enable(false);
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      if (g.world.storyLock) { g.world.storyLock.skip = true; for (let i = 0; i < 300 && g.world.storyLock; i++) g.world.update(); }
      g.world.storyLock = null;
      if (g.world.missions?.state.cinematic) { g.world.missions.state.cinematic = null; g.world.missions.state.phase = 'playing'; }
      g.ui.update();
      await a.screenshotReady();
    });
    await session.page.waitForFunction(() => { const rack = document.querySelector('.hud-weapon-rack'); return !!rack && !!rack.getBoundingClientRect().width; });
    await session.screenshot(`${out}/${level}-start.png`);
    cells.push({ frame: cells.length, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 82 }) });
    await session.page.evaluate(async () => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!;
      const id = g.world.missions!.def.id === 'L4' ? 'weapon.army-mg' : g.world.missions!.def.id === 'L8' ? 'weapon.rocket-launcher' : 'weapon.machete';
      const pickupId = g.world.combat!.pickups.spawn(id, p.transform, false, { retain: true, surfaceY: p.transform.y + 1 });
      g.world.combat!.pickups.update();
      if (g.world.entities.get(pickupId)) throw new Error(`Pickup ${id} was not collected`);
      g.ui.update(); await window.__SS__!.screenshotReady();
    });
    await session.screenshot(`${out}/${level}-after-pickup.png`);
    cells.push({ frame: cells.length, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 82 }) });
  }
  await session.makeSheet(cells, `${out}/rack-captures.jpg`, 640);
  if (session.errors.length) throw new Error(`Browser errors: ${session.errors.join('; ')}`);
} finally { await session.close(); stopServer(); }
