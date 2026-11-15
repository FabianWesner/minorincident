import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { readFixture } from './fixture-io';
import { loadFixtureInPage } from './load-fixture';

// Run under tools/e2e-lock.sh, with SCENE_PORT=4985. This is a native mission
// probe; reported-pose relocation and passive courier protection are fixtures.
const tier = process.env.L9_TIER === 'high' ? 'high' : 'low';
const backend = process.env.L9_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu';
const passive = process.env.L9_PASSIVE === '1';
const realTime = process.env.L9_REALTIME === '1';
const reportedPose = process.env.L9_POSE === 'reported';
const hold = process.env.L9_HOLD === '1';
const fixturePath = process.env.L9_FIXTURE;
const out = process.env.L9_OUT ?? `test-results/s124-trucks-${backend}-${tier}-${passive ? 'passive' : 'skilled'}`;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceChanges = execFileSync('git', ['diff', '--name-only', '--', 'src'], { encoding: 'utf8' }).trim();
const session = new SceneSession({ backend, tier });
mkdirSync(out, { recursive: true });
try {
  await session.open();
  session.page.setDefaultTimeout(120000);
  if (fixturePath) {
    const fixture = readFixture(fixturePath); fixture.campaign.settings.quality = tier;
    await loadFixtureInPage(session.page, fixture);
  }
  await session.page.evaluate(async ({ passive, restored }) => {
    const api = window.__SS__!;
    if (!restored) { await api.loadLevel('L9', { seed: 1, progression: 'L9-default' }); api.missions.begin(); }
    api.pause(); api.bot.start('complete');
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const modulePath = '/src/debug/bot/LevelNineBot.ts';
    const module = await import(/* @vite-ignore */ modulePath);
    if (passive) {
      const apply = game.world.applyInput.bind(game.world);
      game.world.applyInput = (frame, scheme) => apply({
        ...frame, activeAttack: false, mouseAttack: false,
        left: { down: false, held: false, up: false },
        right: { down: false, held: false, up: false },
      }, scheme);
      game.world.player!.damage = () => 0;
    }
    game.driver = new module.LevelNineBot(game.world, 'dry-shortcut', true, .7, 'complete');
    api.camera.follow(); api.camera.zoom(1.5);
  }, { passive, restored: !!fixturePath });
  console.log('level ready');
  const initialTick = await session.page.evaluate(() => window.__SS__!.tick());
  const rows = [];
  let placed = false, capturedComplete = false;
  for (let second = 0; second < (hold ? 240 : fixturePath ? 60 : 360); second++) {
    if (realTime) {
      if (second === 0) await session.page.evaluate(() => window.__SS__!.resume());
      await session.page.waitForTimeout(1000);
    } else {
      await session.page.evaluate(async () => {
        const api = window.__SS__!;
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        api.pause();
        for (let tick = 0; tick < 60; tick++) {
          await api.step(1);
          // advance() alone does not advance the real-time smoke/VFX clock.
          game.view.frame(1 / 60);
        }
      });
    }
    const row = await session.page.evaluate(() => {
      const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
      const state = world.missions!.l9!.driving.state;
      return {
        backend: window.__SS__!.perf().backend,
        quality: window.__SS__!.getState().render.quality,
        tick: world.tick, at: state.evacuationAt, done: state.evacuationDone,
        count: state.evacuated.length, phase: world.missions!.l9!.state.phase,
        infected: world.infected!.active.filter(e => e.health.current > 0 && !e.hidden).length,
        hug: { done: state.hugDone, at: state.hugAt, spot: state.hugSpot },
        dog: [...world.entities.iterate()].filter(e => e.companion).map(e => ({ id: e.id, p: e.transform, passenger: e.passengerOf })),
        actors: state.roster.map(id => {
          const actor = world.entities.get(id)!;
          return { id, infected: !!actor.infected, incubating: !!actor.infection,
            hp: actor.health.current, p: actor.transform, passenger: actor.passengerOf, hidden: actor.hidden };
        }),
      };
    });
    rows.push(row);
    if (second % 10 === 0) console.log(JSON.stringify({ second, tick: row.tick, backend: row.backend, quality: row.quality, evacuationAt: row.at, count: row.count }));
    if (reportedPose && row.at !== null && !placed) {
      placed = true;
      await session.page.evaluate(() => {
        const world = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!;
        const pose = { x: 468.8, z: -1.1, y: car.entity.transform.y, yaw: 0 };
        Object.assign(car.entity.transform, pose); Object.assign(car.physics.previous, pose);
        car.physics.body.setTranslation(pose, true);
        car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      });
    }
    if (row.at !== null && second % 5 === 0) await session.screenshot(`${out}/t${row.tick}.png`);
    if (row.done && !capturedComplete) {
      capturedComplete = true; await session.screenshot(`${out}/complete.png`);
    }
    if (row.done && hold) await session.page.evaluate(() => window.__SS__!.bot.start('idle'));
    if (row.done && !hold || row.phase !== 'driving') break;
  }
  const failures: string[] = [], finish = rows.find(row => row.done);
  if (session.errors.length) failures.push('browser errors');
  if (!finish || finish.count !== 4 || finish.actors.slice(0, 4).some(actor => actor.infected || actor.incubating || actor.hp <= 0)) failures.push('four human evacuees did not finish');
  if (finish && !fixturePath && !reportedPose && finish.at !== null && (finish.tick - finish.at - 1800) / 60 > 20) failures.push('evacuation exceeded 20 seconds after defence');
  if (rows.some(row => row.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu') || row.quality !== tier)) failures.push('runtime backend/tier mismatch');
  const metadata = { revision, sourceChanges, backend, tier, passive, realTime, reportedPose, hold, fixturePath, initialTick };
  writeFileSync(`${out}/rows.json`, JSON.stringify({ metadata, failures, rows, errors: session.errors }, null, 2));
  console.log(JSON.stringify(rows.at(-1)));
  if (failures.length) throw new Error(failures.join('; '));
} finally {
  await session.close(); stopServer();
}
