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
        await api.loadLevel('L3', { seed: 1, progression: 'L3-default' });
        api.missions.begin(); api.pause(); api.camera.follow(); api.camera.zoom(1.5);
        const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
        // Corridor checkpoints are calm-moment snapshots, so they cannot be
        // reconstructed from a fresh objective graph. Reach and restore the real
        // snapshot before handing movement to production keyboard controls.
        api.bot.start('complete');
        for (let tick = 0; tick < 30_000 && world.missions!.state.checkpoint !== 'segment-3b'; tick += 120) await api.step(120);
        api.bot.stop();
        if (world.missions!.state.checkpoint !== 'segment-3b') throw new Error('Native route did not reach segment-3b');
        world.missions!.loadCheckpoint('segment-3b');
        const player = world.entities.get(1)!;
        const ramp = world.districts!.districts.flatMap(d => d.decay.placements).find(p => p.id === 'kit.highway-onramp:991')!;
        const nav = world.infected!.nav, route = { path: [] as number[], goal: -1, pathIndex: 0 };
        if (!nav.steer(player.transform, { x: 139, z: 0 }, route, .45, { x: 0, z: 0 }, Infinity, true, 10)) throw new Error('No connected approach to the ramp foot');
        const approach: [number, number, number][] = route.path.map(cell => [nav.x(cell), 0, nav.z(cell)]);
        return { player: { ...player.transform }, ramp, approach, checkpoint: world.missions!.state.checkpoint, tick: world.tick };
      }, tier);
      // segment-3b restores at the last calm checkpoint, before the ramp foot.
      // Follow the complete authored S-curve rather than aiming at its upper bend.
      const points: [number, number, number][] = [...setup.approach, [139, 0, 0], ...Array.from({ length: 61 }, (_, i) => highwayPoint(setup.ramp, 1 - i / 60))];
      let waypoint = 0;
      for (let tick = 0; tick < 1200 && waypoint < points.length; tick++) {
        const state = await session.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          return { player: { ...game.world.entities.get(1)!.transform }, azimuth: game.view.view.azimuth };
        });
        const target = points[waypoint]!, dx = target[0] - state.player.x, dz = target[2] - state.player.z;
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
      if (waypoint !== points.length || final.player.y < points.at(-1)![1] + .6) {
        receipts.push({ tier, setup, waypoint, target: points[waypoint], final, consoleErrors: session.errors });
        throw new Error(`${tier} courier did not reach the ramp top: ${JSON.stringify(final.player)}`);
      }
      const file = `${out}/l3-ramp-top-${tier}.png`;
      await session.screenshot(file);
      receipts.push({ tier, checkpoint: 'segment-3b', setup: { tick: setup.tick, player: setup.player }, reachedTop: waypoint === points.length, final, screenshot: file, consoleErrors: session.errors });
    } finally { await session.close(); }
  }
} finally {
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ method: 'The native skilled input policy first reaches the real seed 1 segment-3b snapshot, then stops. Restore that snapshot and walk the full S-ramp with production keyboard WASD in headless pooled WebGL2. No teleport, cheats, or movement override. One settled top-of-ramp capture per quality tier.', runs: receipts }, null, 2) + '\n');
  stopServer();
}
console.log(JSON.stringify(receipts, null, 2));
