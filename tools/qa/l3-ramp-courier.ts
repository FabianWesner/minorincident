/** One pooled headless capture per quality tier from the reported L3 segment-3b checkpoint. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { highwayPoint } from '../../src/levels/L3/highway';
import type { Game } from '../../src/Game';

const out = process.env.RAMP_OUT ?? 'test-results/qa/l3-ramp-courier'; mkdirSync(out, { recursive: true });
const receipts: unknown[] = [];
try {
  for (const tier of (process.env.RAMP_TIER ? [process.env.RAMP_TIER as 'low' | 'high'] : ['low', 'high'] as const)) {
    const session = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      // SceneSession hides this button for isolated photos; this run exercises
      // the production mission Retry UI as well as ordinary movement keys.
      await session.page.addStyleTag({ content: '[data-testid=mission-button]{visibility:visible!important}' });
      await session.page.evaluate(async tier => {
        const api = window.__SS__!;
        api.settings.set({ quality: tier });
        await api.loadLevel('L3', { seed: 1, progression: 'L3-default' });
        api.missions.begin(); api.pause(); api.camera.follow(); api.camera.zoom(1.5);
      }, tier);
      for (const restore of (['death', 'restart-retry'] as const).filter(r => !process.env.RAMP_RESTORE || r === process.env.RAMP_RESTORE)) {
        if (restore === 'restart-retry') {
          await session.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.ui.pause(); });
          await session.page.getByTestId('pause-restart').click();
          await session.page.getByTestId('restart-confirm-yes').click();
          await session.page.waitForFunction(() => { const game = (window.__SCENE__ as unknown as { game: Game }).game; return document.body.dataset.uiScreen === 'game' && game.canRestartLevel && game.world.missions?.def.id === 'L3' && game.world.tick < 600; }, null, { timeout: 120000 });
          await session.page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.missions.begin(); });
        }
        const setup = await session.page.evaluate(async restore => {
          const api = window.__SS__!; api.pause(); api.camera.follow(); api.camera.zoom(1.5);
          const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
          // Corridor checkpoints are calm-moment snapshots, so they cannot be
          // reconstructed from a fresh objective graph. Reach and restore the real
          // snapshot before handing movement to production keyboard controls.
          api.bot.start('complete');
          for (let tick = 0; tick < 30_000 && world.missions!.state.checkpoint !== 'segment-3b'; tick += 120) await api.step(120);
          api.bot.stop();
          if (world.missions!.state.checkpoint !== 'segment-3b') throw new Error('Native route did not reach segment-3b');
          if (restore === 'death') {
            world.player!.damage(1000, world.tick, true); await api.step(121);
            if (world.entities.get(1)!.health.current <= 0) throw new Error('Production death did not respawn');
          } else {
            world.events.emit({ type: 'mission.failed', tick: world.tick, reason: 'player-died' });
            await api.step(1);
          }
          return { tick: world.tick, checkpoint: world.missions!.state.checkpoint, phase: world.missions!.state.phase };
        }, restore);
        if (restore === 'restart-retry') {
          await session.page.getByTestId('mission-button').click();
          await session.page.evaluate(() => window.__SS__!.pause());
        }
        const routeSetup = await session.page.evaluate(() => {
          const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
          const player = world.entities.get(1)!;
          const ramp = world.districts!.districts.flatMap(d => d.decay.placements).find(p => p.id === 'kit.highway-onramp:991')!;
          const nav = world.infected!.nav, route = { path: [] as number[], goal: -1, pathIndex: 0 };
          if (!nav.steer(player.transform, { x: 139, z: 0 }, route, .45, { x: 0, z: 0 }, Infinity, true, 10)) throw new Error('No connected approach to the ramp foot');
          const approach: [number, number, number][] = route.path.map(cell => [nav.x(cell), 0, nav.z(cell)]);
          return { player: { ...player.transform }, ramp, approach, checkpoint: world.missions!.state.checkpoint, tick: world.tick };
        });
        console.error(`[ramp] ${tier}/${restore}: segment-3b restored at tick ${routeSetup.tick}`);
        // segment-3b restores at the last calm checkpoint, before the ramp foot.
        // Follow the complete authored S-curve rather than aiming at its upper bend.
        const points: [number, number, number][] = [...routeSetup.approach, [139, 0, 0], ...Array.from({ length: 61 }, (_, i) => highwayPoint(routeSetup.ramp, 1 - i / 60))];
        const trace: unknown[] = [];
        let waypoint = 0, checkedEdge = false, defences = 0;
        for (let tick = 0; tick < 1200 && waypoint < points.length; tick++) {
          const state = await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const p = game.world.entities.get(1)!, blocker = game.world.solids.blockingBody(1);
            return { tick: game.world.tick, player: { ...p.transform }, hp: p.health.current, diedAt: p.survivor?.diedAt,
              staggerUntil: p.combat?.staggerUntil, knockback: p.knockbackSlide,
              blocker: blocker && { id: blocker.id, archetype: blocker.archetype, hp: blocker.health.current, position: { ...blocker.transform } },
              azimuth: game.view.view.azimuth };
          });
          trace.push({ waypoint, target: points[waypoint], ...state });
          if (state.diedAt != null) break;
          if (restore === 'death' && !checkedEdge && state.player.x >= 158.5) {
            checkedEdge = true;
            await session.page.keyboard.down('KeyA'); await session.page.keyboard.down('KeyS');
            try { await session.page.evaluate(async () => window.__SS__!.step(35)); }
            finally { await session.page.keyboard.up('KeyA'); await session.page.keyboard.up('KeyS'); }
            await session.screenshot(`${out}/l3-ramp-edge-${tier}.png`);
            receipts.push({ tier, restore, observation: 'outer-rail pose before recovering inward', state: await session.page.evaluate(() => window.__SS__!.getEntity(1)?.transform) });
            continue;
          }
          const target = points[waypoint]!, dx = target[0] - state.player.x, dz = target[2] - state.player.z;
          if (Math.hypot(dx, dz) < .45) { waypoint++; continue; }
          const distance = Math.hypot(dx, dz), right = Math.cos(state.azimuth) * dx - Math.sin(state.azimuth) * dz,
            down = Math.sin(state.azimuth) * dx + Math.cos(state.azimuth) * dz, keys: string[] = [];
          if (Math.abs(right) / distance > .34) keys.push(right > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(down) / distance > .34) keys.push(down > 0 ? 'KeyS' : 'KeyW');
          // Living infected retain ordinary contact. Fight an intercepting body
          // with the carried axe through the real weapon key and mouse controls.
          const defend = state.blocker && state.blocker.hp > 0 && state.blocker.archetype.startsWith('infected.');
          if (defend) {
            defences++;
            const point = await session.page.evaluate(p => window.__SS__!.input.project(p, 'player'), state.blocker!.position);
            await session.page.keyboard.press('Digit3');
            await session.page.mouse.move(point.x, point.y); await session.page.mouse.down({ button: 'left' });
          }
          for (const key of keys) await session.page.keyboard.down(key);
          try { await session.page.evaluate(async () => window.__SS__!.step(3)); }
          finally { for (const key of keys) await session.page.keyboard.up(key); if (defend) await session.page.mouse.up({ button: 'left' }); }
        }
        const final = await session.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          return { tick: game.world.tick, player: { ...game.world.entities.get(1)!.transform }, objective: game.world.missions!.state.steps.checkpoint?.status,
            ramps: game.view.labProbes().districts!.lodState().filter(p => p.assetId === 'kit.highway-onramp') };
        });
        if (process.env.RAMP_TRACE) writeFileSync(`${out}/trace-${tier}-${restore}.json`, JSON.stringify(trace, null, 2) + '\n');
        if (waypoint !== points.length || final.player.y < points.at(-1)![1] + .6 || final.ramps.find(p => p.position[0] === 155.5)?.lod === 'culled') {
          writeFileSync(`${out}/trace-${tier}-${restore}.json`, JSON.stringify(trace, null, 2) + '\n');
          await session.screenshot(`${out}/failure-${tier}-${restore}.png`);
          receipts.push({ tier, restore, setup, routeSetup, waypoint, target: points[waypoint], final, consoleErrors: session.errors });
          throw new Error(`${tier} courier did not reach the ramp top: ${JSON.stringify(final.player)}`);
        }
        const file = `${out}/l3-ramp-top-${tier}.png`;
        if (restore === 'restart-retry') await session.screenshot(file);
        receipts.push({ tier, restore, checkpoint: 'segment-3b', setup: { ...setup, player: routeSetup.player }, reachedTop: waypoint === points.length, defences, final, screenshot: restore === 'restart-retry' ? file : undefined, consoleErrors: session.errors });
      }
    } finally { await session.close(); }
  }
} finally {
  if (receipts.length) writeFileSync(`${out}/receipt.json`, JSON.stringify({ method: 'The native skilled input policy first reaches the real seed 1 segment-3b snapshot, then stops. Trigger production death/respawn, then the actual pause Restart level and mission Retry buttons; walk the full S-ramp with production keyboard WASD. Use Digit3 and the left mouse button for the carried axe only when a living infected intercepts. No teleport, cheats, or movement override. One settled top-of-ramp capture per quality tier.', renderer: process.platform === 'darwin' ? 'pooled headless WebGL2/Metal' : 'remote headless WebGL2/SwiftShader', runs: receipts }, null, 2) + '\n');
  stopServer();
}
console.log(JSON.stringify(receipts, null, 2));
