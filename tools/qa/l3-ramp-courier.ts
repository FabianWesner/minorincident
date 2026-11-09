/** One pooled headless capture per quality tier from the reported L3 segment-3b checkpoint. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { highwayPoint } from '../../src/levels/L3/highway';
import type { Game } from '../../src/Game';

const out = 'test-results/qa/l3-ramp-courier'; mkdirSync(out, { recursive: true });
const receipts: unknown[] = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      const setup = await session.page.evaluate(async tier => {
        const api = window.__SS__!;
        api.settings.set({ quality: tier });
        await api.loadLevel('L3', { seed: 1, checkpoint: 'segment-3b', progression: 'L3-default' });
        api.missions.begin(); api.pause(); api.camera.follow(); api.camera.zoom(1.5);
        const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const player = world.entities.get(1)!;
        const ramp = world.districts!.districts.flatMap(d => d.decay.placements).find(p => p.id === 'kit.highway-onramp:991')!;
        const points = Array.from({ length: 41 }, (_, i) => highwayPoint(ramp, .4 * (1 - i / 40)));
        let nearest = 0;
        for (let i = 1; i < points.length; i++) if (Math.hypot(player.transform.x - points[i]![0], player.transform.z - points[i]![2]) < Math.hypot(player.transform.x - points[nearest]![0], player.transform.z - points[nearest]![2])) nearest = i;
        return { player: { ...player.transform }, points, nearest, tick: world.tick };
      }, tier);
      let waypoint = Math.min(setup.nearest + 1, setup.points.length - 1);
      for (let tick = 0; tick < 500 && waypoint < setup.points.length; tick++) {
        const state = await session.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          return { player: { ...game.world.entities.get(1)!.transform }, azimuth: game.view.view.azimuth };
        });
        const target = setup.points[waypoint]!, dx = target[0] - state.player.x, dz = target[2] - state.player.z;
        if (Math.hypot(dx, dz) < .45) { waypoint++; continue; }
        const distance = Math.hypot(dx, dz), right = Math.cos(state.azimuth) * dx - Math.sin(state.azimuth) * dz,
          down = Math.sin(state.azimuth) * dx + Math.cos(state.azimuth) * dz, keys: string[] = [];
        if (Math.abs(right) / distance > .34) keys.push(right > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(down) / distance > .34) keys.push(down > 0 ? 'KeyS' : 'KeyW');
        for (const key of keys) await session.page.keyboard.down(key);
        try { await session.page.evaluate(async () => window.__SS__!.step(3)); }
        finally { for (const key of keys) await session.page.keyboard.up(key); }
      }
      const final = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        return { tick: game.world.tick, player: { ...game.world.entities.get(1)!.transform }, objective: game.world.missions!.state.steps.checkpoint?.status };
      });
      if (waypoint !== setup.points.length) throw new Error(`${tier} courier did not reach the ramp top: ${JSON.stringify(final.player)}`);
      const file = `${out}/l3-ramp-top-${tier}.png`;
      await session.screenshot(file);
      receipts.push({ tier, checkpoint: 'segment-3b', setup: { tick: setup.tick, player: setup.player }, reachedTop: waypoint === setup.points.length, final, screenshot: file, consoleErrors: session.errors });
    } finally { await session.close(); }
  }
} finally {
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ method: 'Production keyboard WASD in a headless pooled WebGL2 browser, loaded from seed 1 segment-3b; no teleport, route bot, or movement override. One settled top-of-ramp capture per quality tier.', runs: receipts }, null, 2) + '\n');
  stopServer();
}
console.log(JSON.stringify(receipts, null, 2));
