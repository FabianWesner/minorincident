/** Glass visibility fixture: real seated pedestrian rigs placed at delivered sockets.
 * Campaign boarding/occupant lifecycle is covered by the separate PKG-13/14 lane. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { assetIO } from '../assets/io';
import { SceneSession, stopServer } from './session';
import type { ActorSpec } from '../../src/debug/scenelab/spec';
import { vehicles } from '../../src/data/vehicles';
import { getBounds } from '@gltf-transform/functions';

const out = process.argv[2] ?? 'test-results/vehicle-glass/after';
const io = await assetIO(), session = new SceneSession(), metrics: unknown[] = [];
const human = await io.read('public/assets/models/npc.firefighter-alive.glb');
const bounds = getBounds(human.getRoot().listScenes()[0]), height = bounds.max[1] - bounds.min[1];
const hip = (human.getRoot().listNodes().find(n => n.getName() === 'hip')!.getWorldTranslation()[1] - .22) * (Math.abs(height / 1.8 - 1) > .08 ? 1.8 / height : 1);
mkdirSync(out, { recursive: true });
try {
  await session.open();
  for (const id of ['fire-engine', 'school-bus']) {
    console.log(`Capturing seated ${id}`);
    const def = vehicles.find(v => v.asset === `veh.${id}`)!;
    const doc = await io.read(`${process.env.VEHICLE_SEAT_MODELS ?? 'public/assets/models'}/veh.${id}.glb`);
    const names = ['driverSeat', ...(id === 'fire-engine' ? Array.from({ length: 6 }, (_, i) => `crewSeat${i}`) : ['passengerSeat0L', 'passengerSeat0R'])];
    const actors: ActorSpec[] = names.map(name => {
      const [x, y, z] = doc.getRoot().listNodes().find(n => n.getName() === name)!.getWorldTranslation();
      return { id: name, kind: 'pedestrian', at: [x, z], floorY: y - hip, yaw: 0,
        look: { model: 'npc.firefighter-alive', handProp: null }, state: { routine: 'sit' } };
    });
    const cells: { frame: number; jpeg: Buffer }[] = [];
    for (const mode of ['game', 'close'] as const) {
      await session.load({ ground: 'asphalt', size: 24, time: 'L2', vehicles: [{ id: 'car', asset: def.id, at: [0, 0] }],
        camera: mode === 'game' ? { mode, target: [0, 1, 0] } : { mode, target: [1, 1.6, 0], radius: 9, azimuth: 45 },
        expect: { consoleErrors: 0 } });
      await session.step(60);
      const offset = await session.page.evaluate(() => {
        const car = window.__SS__!.getState().entities.find(e => e.vehicle)!;
        return car.transform.y;
      }) - (def.suspension + def.wheelRadius + .15);
      await session.page.evaluate(actors => {
        // Fixtures are attached passengers: crowd separation must not push them
        // out of their sockets and replace their seated pose with locomotion.
        const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
        const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
        for (const actor of actors) {
          lab.spawnActor(actor);
          game.world.entities.get(lab.actors.get(actor.id!)!.entity)!.attachedTo = lab.vehicles.get('car');
        }
      }, actors.map(a => ({ ...a, floorY: a.floorY! + offset })));
      await session.step(60); await session.ready();
      await session.page.evaluate(({ actors, hip, offset }) => {
        const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
        const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
        const figures = game.view.labProbes().npcs!.snapshot().civilians.figures;
        for (const actor of actors) {
          const entity = game.world.entities.get(lab.actors.get(actor.id!)!.entity)!;
          const figure = figures.find(f => f.id === entity.id && f.drawn)!;
          if (figure.clip !== 'npc-sit' || !figure.joints?.hip) throw new Error(`${actor.id}: seated rig not ready`);
          // The shipped crowd bake fits the standing rig to adult height.
          // Calibrate its pelvis probe, rather than treating that bake as the raw GLB.
          const correction = actor.floorY! + hip + offset - figure.joints.hip[1];
          entity.transform.y += correction; entity.civilian!.floorY! += correction;
        }
      }, { actors, hip, offset });
      await session.step(1);
      const seats = await session.page.evaluate(({ actors, hip, offset }) => {
        const lab = window.__SCENE__ as unknown as import('../../src/debug/scenelab/SceneLab').SceneLab;
        const game = (lab as unknown as { game: import('../../src/Game').Game }).game;
        const drawn = game.view.labProbes().npcs!.snapshot().civilians.figures;
        return actors.map(actor => {
          const entity = lab.actors.get(actor.id!)!.entity;
          const pelvis = drawn.find(f => f.id === entity && f.drawn)!.joints!.hip;
          const target = [actor.at![0], actor.floorY! + hip + offset, actor.at![1]];
          const errorM = Math.hypot(...pelvis.map((value, axis) => value - target[axis]));
          if (errorM > .03) throw new Error(`${actor.id}: pelvis ${errorM} m off socket`);
          return { id: actor.id, target, pelvis, errorM };
        });
      }, { actors, hip, offset });
      await session.screenshot(`${out}/${id}-occupants-${mode}.png`);
      cells.push({ frame: mode === 'game' ? 0 : 1, jpeg: await session.snapshot() });
      metrics.push({ id, mode, actors, seats, metrics: await session.metrics(), errors: session.errors });
    }
    await session.makeSheet(cells, `${out}/${id}-occupants.jpg`, 640);
  }
  writeFileSync(`${out}/occupants-metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
