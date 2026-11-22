import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const tier = process.env.CAPTURE_TIER === 'low' ? 'low' : 'high';
const out = 'test-results/s232-l9'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1280, height: 720 } });
try {
  await s.open();
  await s.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L9', { seed: 1, progression: 'L9-default' }); a.pause(); a.missions.begin(); a.camera.follow(); a.camera.zoom(1); await a.step(30); });
  await s.page.keyboard.down('KeyW'); await s.page.evaluate(async () => window.__SS__!.step(90));
  const setup = await s.page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!, p = car.entity.transform;
    const x = p.x + Math.cos(p.yaw) * (car.physics.def.length / 2 + 6), z = p.z - Math.sin(p.yaw) * (car.physics.def.length / 2 + 6);
    const id = w.infected!.spawn('infected.runner', { x, z }, { state: 'chase' });
    const actor = w.entities.get(id)!; actor.infected!.state = 'idle'; actor.combat!.staggerUntil = w.tick + 180;
    const hits: unknown[] = []; w.events.on('vehicle.infected-hit', e => { if (e.type === 'vehicle.infected-hit' && e.targetId === id) hits.push(e); });
    (window as unknown as { s232: { id: number; hits: unknown[] } }).s232 = { id, hits };
    return { id, speed: car.physics.speed, car: { ...p }, target: { ...actor.transform } };
  });
  const cells: { frame: number; jpeg: Buffer }[] = [];
  for (let frame = 0; frame <= 90; frame++) {
    if (frame) await s.page.evaluate(async () => window.__SS__!.step(1));
    if (frame % 5 === 0) { await s.ready(); cells.push({ frame, jpeg: await s.snapshot() }); }
  }
  await s.page.keyboard.up('KeyW');
  const result = await s.page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world, probe = (window as unknown as { s232: { id: number; hits: unknown[] } }).s232, e = w.entities.get(probe.id), car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!; return { ...probe, target: e && { health: e.health, corpse: e.corpse, squashed: e.squashed, transform: e.transform }, car: { speed: car.physics.speed, upsideDown: car.physics.upsideDown, transform: car.entity.transform } }; });
  await s.makeSheet(cells, `${out}/${tier}.jpg`, 320); writeFileSync(`${out}/${tier}.json`, JSON.stringify({ setup, result, errors: s.errors }, null, 2));
  console.log(JSON.stringify({ tier, setup, result, errors: s.errors }));
} finally { await s.close(); stopServer(); }
