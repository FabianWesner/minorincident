/** E2E_UNITS=1 SCENE_PORT=33971 sh tools/e2e-lock.sh node --import tsx tools/qa/r15-megarun-capture.ts before|after */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
type ContactProbe = { target: { toArray(): number[] }; locked: boolean; phase: number; swing?: { u: number } };
type ContactView = { crowd: { footwork: { states: Map<number, { contacts: { feet: ContactProbe[] } }> } } };

const side = process.argv[2];
if (!['before', 'after'].includes(side)) throw new Error('Supply before or after');
const speed = process.env.R15_SPEED ? Number(process.env.R15_SPEED) : undefined;
const model = process.env.R15_MODEL;
const root = resolve(`test-results/r15-megarun/${side}${speed === undefined ? '' : `-speed${speed}`}${process.env.R15_TURN ? '-turn' : ''}${process.env.R15_ZOOM ? `-zoom${process.env.R15_ZOOM}` : ''}${model ? `-model${model}` : ''}`);
const directions = { toward: [1, 1], away: [-1, -1], across: [1, -1] } as const;
const frames = process.env.R15_TURN ? [60, 72, 84, 96, 108, 120] : [60, 66, 72, 78, 84, 90];
const summary: unknown[] = [];
const base = readSpec('tests/scenes/catalog/r15-megarun.json');
try {
  for (const tier of ['high', 'low'] as const) {
    if (process.env.R15_FILTER?.startsWith('high-') && tier !== 'high' || process.env.R15_FILTER?.startsWith('low-') && tier !== 'low') continue;
    const session = new SceneSession({ tier, viewport: { width: 960, height: 720 }, backend: 'webgl2', seed: 32 });
    try {
      await session.open();
      for (const zoom of process.env.R15_ZOOM ? [Number(process.env.R15_ZOOM)] : [1, 1.5]) for (const [direction, vector] of Object.entries(directions)) {
        const name = `${tier}-z${zoom}-${direction}`, out = `${root}/${name}`; mkdirSync(out, { recursive: true });
        if (process.env.R15_FILTER && !name.includes(process.env.R15_FILTER)) continue;
        const spec: SceneSpec = {
          ...base, name: `r15-${name}`,
          actors: [{ id: 'courier', kind: 'courier', at: [vector[0] * 40, vector[1] * 40], god: true }],
          camera: { mode: 'game', target: 'mega', zoom },
        };
        const scene = await session.load(spec), megaId = scene.actors.find(a => a.id === 'mega')!.entity;
        if (model) await session.page.evaluate(({ id, model }) => {
          (window.__SCENE__ as unknown as { game: Game }).game.world.entities.get(id)!.infected!.model = model;
        }, { id: megaId, model });
        if (speed !== undefined) await session.page.evaluate(({ speed, id }) => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          if (speed > 10) {
            // L8's story owns the transform at 11/14 m/s, without the pursuit acceleration ramp.
            game.world.megaPursuit!.dispose(); game.world.megaPursuit = null;
            const e = game.world.entities.get(id)!, p = game.world.entities.get(1)!.transform;
            delete e.infected!.pursuit; game.world.npcs!.civilians.hold(id);
            const dx = p.x - e.transform.x, dz = p.z - e.transform.z, length = Math.hypot(dx, dz), vx = dx / length * speed, vz = dz / length * speed;
            game.world.events.on('sim.tick', () => {
              e.transform.x += vx / 60; e.transform.z += vz / 60; e.transform.yaw = -Math.atan2(vz, vx);
              game.world.spatial.set(id, e.transform.x, e.transform.z);
            }, 5);
          } else if (speed >= 5.4) { game.world.scenario = 'L10'; game.world.player!.progressionSpeed = speed / 5.4; }
          else { game.world.megaPursuit!.dispose(); game.world.megaPursuit = null; const e = game.world.entities.get(id)!; delete e.infected!.pursuit; e.infected!.speed = speed; }
        }, { speed, id: megaId });
        const poses: unknown[] = [];
        let current = 0;
        for (const frame of frames) {
          await session.step(frame - current); current = frame; await session.ready();
          await session.page.screenshot({ path: `${out}/f${frame}.png`, clip: { x: 280, y: 80, width: 400, height: 400 } });
          poses.push({ frame, figure: await session.page.evaluate(id => {
            const view = (window.__SCENE__ as unknown as { game: Game }).game.view;
            const contacts = (view as unknown as ContactView).crowd.footwork.states.get(id)?.contacts;
            return { ...view.crowdFigures().find(f => f.id === id), contactTargets: contacts?.feet.map(f => ({ target: f.target.toArray(), locked: f.locked, phase: f.phase, swing: f.swing?.u })) };
          }, megaId) });
          if (process.env.R15_TURN && frame === 60) await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const p = game.world.entities.get(1)!; p.transform.x = -40; p.transform.z = -40;
          });
        }
        await session.step(120 - current);
        const metrics = await session.metrics();
        writeFileSync(`${out}/metrics.json`, JSON.stringify({ metrics, poses, consoleErrors: session.errors }));
        const row = { side, name, frames, consoleErrors: session.errors, mega: metrics.actors.mega.motion, lod: metrics.actors.mega.lod };
        summary.push(row); console.log(JSON.stringify(row));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
mkdirSync(root, { recursive: true }); writeFileSync(`${root}/summary.json`, JSON.stringify(summary, null, 2));
