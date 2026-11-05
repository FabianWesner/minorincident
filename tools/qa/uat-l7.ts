/** L7 UAT game-camera evidence. Uses the shared headless pool and real pointer/keyboard input. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.argv[2] ?? 'test-results/uat-l7/before';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 800 }, query: { level: 'L7' } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = (fn) => fn');
  if (!process.argv.includes('--l8-only')) {
  await session.page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L7', { seed: 29, progression: 'L7-default' });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
  });
  const spots = [['northgate', 233, 32], ['lake-strip', -30, 60], ['corridor', -52, 50],
    ['night-exit', 273, 15], ['northgate-mid', 173, 15], ['northgate-west', 113, 15], ['junction', 78, 28.6],
    ['harbor', 35, -40], ['west-alley', -78, 0], ['bus', -70.5, 47.5]] as const;
  for (const tier of ['high', 'low'] as const) for (const zoom of [1, 1.5]) for (const [spot, x, z] of out.endsWith('/before') ? spots.slice(0, 3) : spots) {
    await session.page.evaluate(async ({ tier, zoom, x, z }) => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      a.settings.set({ quality: tier }); a.teleport(1, { x, z });
      g.view.view.zoom(Math.log(zoom / g.view.view.getState().targetZoom), true);
      await a.step(2); await a.screenshotReady();
    }, { tier, zoom, x, z });
    await session.page.screenshot({ path: `${out}/${spot}-${tier}-z${zoom}.jpg`, type: 'jpeg', quality: 82 });
  }
  // Ordinary E interaction collects the retained pickup; then hold LMB through five discharges.
  await session.page.evaluate(async () => {
    const a = window.__SS__!;
    a.teleport(1, { x: 276, z: 15 }); await a.step(1);
  });
  await session.page.keyboard.down('KeyE');
  await session.page.evaluate(() => window.__SS__!.step(45));
  await session.page.keyboard.up('KeyE');
  const point = await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.teleport(1, { x: 266, z: 15 }); await a.step(30);
    const q = g.view.project(251, 3.9, 15);
    return { x: (q[0] + 1) * innerWidth / 2, y: (1 - q[1]) * innerHeight / 2, tick: a.tick() };
  });
  await session.page.mouse.move(point.x, point.y);
  await session.page.mouse.down();
  for (let i = 0; i < 10; i++) {
    await session.page.evaluate(() => window.__SS__!.step(50));
    if (i < 5) { await session.ready(); await session.page.screenshot({ path: `${out}/rockets-${i}.jpg`, type: 'jpeg', quality: 82 }); }
  }
  await session.page.mouse.up(); await session.page.keyboard.up('Shift');
  const result = await session.page.evaluate((tick) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    const events = g.world.events.events().filter(e => e.tick >= tick && (e.type === 'combat.attack' || e.type === 'combat.exploded'));
    return { events, selected: g.world.combat!.runner.loadout.state, player: a.getEntity(1)!.transform, errors: g.world.solids.snapshot() };
  }, point.tick);
  writeFileSync(`${out}/input-evidence.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.events.filter(e => e.type === 'combat.attack').map(e => e.tick)));
  }
  if (!out.endsWith('/before')) {
    await session.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L8', { seed: 29, progression: 'L8-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); });
    for (const tier of ['high', 'low'] as const) for (const zoom of [1, 1.5]) for (const [spot, x, z] of [['arrival', 0, 70], ['street-west', 32, 74], ['street-east', 64, 74], ['exit', 90, 74]] as const) {
      await session.page.evaluate(async ({ tier, zoom, x, z }) => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        a.settings.set({ quality: tier }); a.teleport(1, { x, z });
        const at = a.getEntity(1)!.transform;
        if (Math.hypot(at.x - x, at.z - z) > 2) throw new Error(`L8 capture spot blocked: ${x}, ${z}`);
        g.view.view.zoom(Math.log(zoom / g.view.view.getState().targetZoom), true); await a.step(2); await a.screenshotReady();
      }, { tier, zoom, x, z });
      await session.page.screenshot({ path: `${out}/l8-${spot}-${tier}-z${zoom}.jpg`, type: 'jpeg', quality: 82 });
    }
  }
} finally { await session.close(); stopServer(); }
