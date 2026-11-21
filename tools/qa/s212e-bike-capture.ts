import { resolve } from 'node:path';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const tier = process.env.BIKE_TIER === 'low' ? 'low' : 'high';
const s = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1280, height: 720 } });
try {
  await s.open();
  await s.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L10', { seed: 1 }); a.missions.begin(); a.pause();
    a.teleport(1, { x: 2800, z: 45 }); a.camera.follow(); a.camera.zoom(1); await a.step(120);
  });
  await s.page.keyboard.down('KeyE'); await s.page.evaluate(async () => window.__SS__!.step(1)); await s.page.keyboard.up('KeyE');
  await s.page.keyboard.down('KeyW'); await s.page.evaluate(async () => window.__SS__!.step(120)); await s.page.keyboard.up('KeyW');
  console.log(await s.page.evaluate(() => { const w = (window.__SCENE__ as unknown as {game: Game}).game.world; const bike = w.vehicles!.bicycle.entity!; const dog = [...w.entities.iterate()].find(e => e.companion); return { bike: bike.bicycle, player: w.entities.get(1)!.transform, dog: dog && { passengerOf: dog.passengerOf, transform: dog.transform } }; }));
  await s.page.evaluate(async () => window.__SS__!.screenshotReady());
  await s.screenshot(resolve(`docs/reports/s212e-finale/motorbike-${tier}.png`));
} finally { await s.close(); stopServer(); }
