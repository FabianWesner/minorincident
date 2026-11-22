import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const tier = process.env.CAPTURE_TIER === 'low' ? 'low' : 'high';
const out = 'test-results/s232-l10'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1280, height: 720 } });
try {
  await s.open();
  await s.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 1 }); a.missions.begin(); a.pause(); a.teleport(1, { x: 2800, z: 45 }); a.camera.follow(); a.camera.zoom(1); await a.step(120); });
  await s.page.keyboard.down('KeyE'); await s.page.evaluate(async () => window.__SS__!.step(1)); await s.page.keyboard.up('KeyE');
  await s.page.keyboard.down('KeyW'); await s.page.evaluate(async () => window.__SS__!.step(70));
  const setup = await s.page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, p = w.entities.get(1)!, bike = w.vehicles!.bicycle.entity!;
    if (!bike.bicycle?.mounted || !bike.bicycle.motorbike) throw new Error('Motorbike not mounted');
    const b = bike.bicycle, x = p.transform.x + Math.cos(b.heading) * 5, z = p.transform.z + Math.sin(b.heading) * 5;
    const id = w.infected!.spawn('infected.runner', { x, z }, { state: 'chase' });
    const actor = w.entities.get(id)!; actor.infected!.state = 'idle'; actor.combat!.staggerUntil = w.tick + 180;
    const hits: unknown[] = []; w.events.on('vehicle.infected-hit', e => { if (e.type === 'vehicle.infected-hit' && e.targetId === id) hits.push(e); });
    (window as unknown as { s232: { id: number; hits: unknown[] } }).s232 = { id, hits };
    return { id, speed: b.speed, player: p.transform, target: actor.transform };
  });
  const cells: { frame: number; jpeg: Buffer }[] = [];
  const motion: { frame: number; tick: number; position: number[]; orientation: number[] }[] = [];
  for (let frame = 0; frame <= 100; frame++) {
    if (frame) await s.page.evaluate(async () => window.__SS__!.step(1));
    if (frame >= 20 && frame <= 55) {
      await s.ready();
      const sample = await s.page.evaluate(() => { const game = (window.__SCENE__ as unknown as { game: Game }).game, pose = game.view.labProbes().bicycle?.snapshot(); return pose && { tick: game.world.tick, position: pose.position, orientation: pose.orientation }; });
      if (sample) motion.push({ frame, ...sample });
    }
    if (frame >= 20 && frame <= 65 && frame % 5 === 0) { await s.ready(); cells.push({ frame, jpeg: await s.page.screenshot({ type: 'jpeg', quality: 82, clip: { x: 460, y: 230, width: 360, height: 270 } }) }); }
  }
  await s.page.keyboard.up('KeyW');
  const result = await s.page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world, probe = (window as unknown as { s232: { id: number; hits: unknown[] } }).s232, e = w.entities.get(probe.id); const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const crowd = Reflect.get(game.view, 'crowd'), frozen = crowd && Reflect.get(crowd, 'staticCorpses');
    const slot = frozen && Reflect.get(frozen, 'slots').get(String(probe.id));
    if (slot) slot.page.mesh.geometry.computeBoundingBox();
    const bounds = slot?.page.mesh.geometry.boundingBox;
    const height = bounds ? (bounds.max.y - bounds.min.y) * slot.page.mesh.instanceMatrix.array[slot.index * 16 + 5] : null;
    const matrix = slot ? Array.from(slot.page.mesh.instanceMatrix.array.slice(slot.index * 16, slot.index * 16 + 16)) : null;
    return { matrix, height, ...probe, target: e && { health: e.health, corpse: e.corpse, squashed: e.squashed, transform: e.transform }, bike: w.vehicles!.bicycle.entity!.bicycle }; });
  await s.makeSheet(cells, `${out}/${tier}-close.jpg`, 320); writeFileSync(`${out}/${tier}-close.json`, JSON.stringify({ setup, result, motion, errors: s.errors }, null, 2));
  console.log(JSON.stringify({ tier, setup, result, errors: s.errors }));
} finally { await s.close(); stopServer(); }
