import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { readFixture } from './fixture-io';
import { loadFixtureInPage } from './load-fixture';

// The restored crowd emits native scream pulses during these six seconds.
// Alternating tiers covers both render paths; switching is not the pulse cause.
// Run under tools/e2e-lock.sh with SCENE_PORT=4985 and optional L9_BACKEND=webgl2.
const backend = process.env.L9_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu';
const mode = process.env.L9_ABLATE ?? 'none';
const sequence = process.env.SCREAM_SEQUENCE === '1';
const out = `test-results/${sequence ? 's130-sequence' : 's124-pulse'}-${backend}-${mode}`;
const session = new SceneSession({ backend, tier: 'high' });
mkdirSync(out, { recursive: true });
try {
  await session.open();
  if (sequence) {
    const rows = [];
    const sequenceErrors: string[] = [];
    for (const level of ['L9', 'L10']) for (const version of ['before', 'after']) {
      // Isolate fixture lifetimes: pending WebGPU compilation must finish before world disposal.
      await session.close(); await session.open();
      const fixture = readFixture(level === 'L9' ? 'tests/fixtures/saves/qa/s124-l9-crowded-trucks.json.br' : 'tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
      fixture.campaign.settings.quality = 'high';
      await loadFixtureInPage(session.page, fixture);
      const setup = await session.page.evaluate(version => {
        const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
        api.camera.follow(); api.camera.zoom(1);
        const player = game.world.entities.get(1)!;
        let source = [...game.world.entities.iterate()].filter(e => e.health.current > 0 && e.archetype === 'infected.screamer').sort((a, b) => Math.hypot(a.transform.x-player.transform.x,a.transform.z-player.transform.z)-Math.hypot(b.transform.x-player.transform.x,b.transform.z-player.transform.z))[0];
        if (!source) {
          const id = game.world.infected!.spawn('infected.screamer', { x: player.transform.x + 5, z: player.transform.z - 3 });
          source = game.world.entities.get(id)!;
        }
        // Scene fixture: bring the courier within sight of the existing actor, then run with normal input.
        api.teleport('player', { x: source.transform.x - 5, z: source.transform.z + 3 });
        const fx = game.view.vfx!;
        const x = source.transform.x, z = source.transform.z;
        if (version === 'before') {
          const original = fx.effect.bind(fx);
          fx.effect = (kind, x, z, radius = 2, height = .7) => {
            if (kind !== 'screamer') return original(kind, x, z, radius, height);
            const slot = fx.waves.spawn(fx.snapshot().time, 1, x, .03, z, 0, 0, 0, radius * 2, 8, 0xef92ff, 1); fx.waves.opacity(slot, .25);
          };
          const slot = fx.waves.spawn(fx.snapshot().time, 1, x, .03, z, 0, 0, 0, 40, 8, 0xef92ff, 1); fx.waves.opacity(slot, .25);
        } else fx.effect('screamer', x, z, 20);
        api.input.set({ move: { x: 1, z: 0 }, aim: { x: 1, z: 0 } });
        return { sourceId: source.id, source: { x, z }, player: { ...player.transform }, tick: api.tick() };
      }, version);
      for (const frame of [3, 6, 12, 24, 30]) {
        const state = await session.page.evaluate(async ticks => {
          const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
          for (let i = 0; i < ticks; i++) { await api.step(1); game.view.frame(1/60); }
          return { ...game.world.entities.get(1)!.transform };
        }, frame === 3 ? 3 : frame === 6 ? 3 : frame === 12 ? 6 : frame === 24 ? 12 : 6);
        const file = `${level}-${version}-${frame}.jpg`;
        await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 });
        rows.push({ level, version, frame, seconds: frame/60, setup, player: state, file });
      }
      sequenceErrors.push(...session.errors);
    }
    writeFileSync(`${out}/rows.json`, JSON.stringify({ backend, fixture: 'scripted visual scream at existing living source; normal movement, no stat edits', rows, errors: sequenceErrors }, null, 2));
    if (sequenceErrors.length) throw new Error('browser errors');
  } else {
  const fixture = readFixture('tests/fixtures/saves/qa/s124-l9-crowded-trucks.json.br');
  fixture.campaign.settings.quality = 'high';
  await loadFixtureInPage(session.page, fixture);
  await session.page.evaluate(mode => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    window.__SS__!.camera.follow(); window.__SS__!.camera.zoom(1.5);
    // Diagnostic controls preserve the same world and simulation events.
    if (mode === 'no-vfx') game.view.vfx?.removeFromParent();
    if (mode === 'no-field') Object.defineProperty(game.view.lightField!, 'active', { get: () => false });
  }, mode);
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const tier: 'high' | 'low' = i % 2 ? 'high' : 'low';
    await session.page.evaluate(async (tier: 'high' | 'low') => {
      const api = window.__SS__!;
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      api.settings.set({ quality: tier });
      for (let tick = 0; tick < 60; tick++) {
        await api.step(1); game.view.frame(1 / 60);
      }
    }, tier);
    // Capture the actual pulse frame, without waiting for streaming/warmup.
    const bytes = await session.page.screenshot({ path: `${out}/${i}-${tier}.png` });
    const png = PNG.sync.read(bytes);
    let pink = 0;
    for (let p = 0; p < png.data.length; p += 4) {
      const [r, g, b] = png.data.subarray(p, p + 3);
      if (r > 160 && b > 180 && r - g > 30 && b - g > 45) pink++;
    }
    rows.push({ i, tier, pink });
    console.log(JSON.stringify(rows.at(-1)));
  }
  writeFileSync(`${out}/rows.json`, JSON.stringify({ backend, mode, rows, errors: session.errors }, null, 2));
  // Before the fix the matched HIGH frame has 190,108 bright-pink pixels.
  if (rows.some(row => row.pink > 5000) || session.errors.length) throw new Error('broad pink ground or browser errors');
  }
} finally {
  await session.close(); stopServer();
}
