/** E25 named lighting views and accepted-look before/after captures. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { DistrictView } from '../../src/render/DistrictView';
const out = process.env.E25_OUT ?? 'test-results/epics/E25/spots'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend: 'webgl2', tier: 'high' });
const results: unknown[] = [];
const levels = process.env.E25_LEVELS?.split(',');
try {
  await s.open();
  await s.page.evaluate('globalThis.__name = (fn) => fn');
  for (const [level, suffix] of [['L1', ''], ['L2', 'l2-streets-w1'], ['L3', 'l3-grove-boulevard'], ['L4', 'l4-plaza-safe'], ['L5', 'pair-plaza'], ['L6', 'l6-shelter-fails']]) {
    if (levels && !levels.includes(level)) continue;
    await s.close(); await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
    await s.page.evaluate(async level => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, reset = game.clock.reset.bind(game.clock);
      // Level loading resets the clock, then awaits shader/audio warm-up. Keep the
      // real simulation paused for that entire interval, not just after it resolves.
      game.clock.reset = () => { reset(); game.clock.pause(); };
      game.clock.resume = () => {}; game.clock.pause();
      await window.__SS__!.loadLevel(level, { seed: 1 }); window.__SS__!.pause();
    }, level);
    const setup = await s.page.evaluate(async ({ level, suffix }) => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const districts = (game.view as unknown as { districts: DistrictView }).districts;
      const key = [...districts.spots.keys()].find(k => k.endsWith(`/${suffix}`) || k === suffix);
      if (suffix && !key) return { missing: suffix, available: [...districts.spots.keys()] };
      if (key) {
        const pose = districts.spots.get(key)!; window.__SS__!.teleport('player', { x: pose.target[0], z: pose.target[2] });
        window.__SS__!.camera.preset(key);
      }
      if (level === 'L6') {
        const state = game.world.missions!.state.l6!; state.flashlight = true;
        game.world.lightPower!.setGroup('metro-main', false);
      }
      window.__SS__!.cheats.god(true); await window.__SS__!.step(120);
      if (key) window.__SS__!.camera.preset(key);
      game.view.advance(0); game.view.renderer.nextNodeFrame(); game.view.update(1);
      return { tick: game.world.tick, key: key ?? 'entry', state: window.__SS__!.getState().render, stagedFailure: level === 'L6' };
    }, { level, suffix });
    if ('missing' in setup) { results.push({ level, ...setup }); continue; }
    await s.page.evaluate(() => window.__SS__!.screenshotReady());
    const png = await s.page.evaluate(async () => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      // Match Three's depth/order sorting; replace only its asynchronous object-id tie break.
      const keys = new WeakMap<import('three').Object3D, string>();
      const key = (object: import('three').Object3D | null) => {
        if (!object) return '';
        let value = keys.get(object); if (value) return value;
        const names: string[] = []; for (let n: import('three').Object3D | null = object; n; n = n.parent) names.push(n.name);
        const geometry = (object as import('three').Mesh).geometry;
        value = names.reverse().join('/') + ':' + (geometry?.index?.count ?? geometry?.getAttribute('position')?.count ?? 0); keys.set(object, value); return value;
      };
      game.view.renderer.setOpaqueSort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0) || (a.renderOrder ?? 0) - (b.renderOrder ?? 0) || (a.z ?? 0) - (b.z ?? 0) || key(a.object).localeCompare(key(b.object)));
      game.view.renderer.setTransparentSort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0) || (a.renderOrder ?? 0) - (b.renderOrder ?? 0) || (b.z ?? 0) - (a.z ?? 0) || key(a.object).localeCompare(key(b.object)));
      game.view.renderer.nextNodeFrame();
      const frame = (game.view.renderer as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame; frame.time = 0; frame.deltaTime = 0;
      for (let i = 0; i < 20; i++) { game.view.renderer.nextNodeFrame(); frame.time = frame.deltaTime = 0; game.view.update(1); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); }
      game.view.renderer.nextNodeFrame(); frame.time = frame.deltaTime = 0; game.view.update(1); return game.view.renderer.domElement.toDataURL('image/png').split(',')[1];
    });
    writeFileSync(`${out}/${level}.png`, Buffer.from(png, 'base64')); results.push({ level, ...setup, errors: [...s.errors] }); console.log(level, setup.key);
  }
  try { await s.page.evaluate(() => window.__SS__!.loadLevel('mall-floor', { seed: 1 })); results.push({ level: 'mall-floor', loaded: true }); }
  catch (error) { results.push({ level: 'mall-floor', error: String(error) }); }
} finally { writeFileSync(`${out}/measurements.json`, JSON.stringify(results, null, 2) + '\n'); await s.close(); stopServer(); }
