/** Requalify the outdated companion fixture against the actual authored rear doorway. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { vehicleDef } from '../../../src/data/vehicles.ts';
import { SceneSession, readSpec, stopServer } from '../../scenelab/session.ts';
import { provenance } from './probe.ts';
const out = 'test-results/sweep-g/G-19-apc'; mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Companion fixture setup corrected to production transport.entry rear door; original front-driver-door rejection retained separately. Actual boardPassenger/disembarkPassenger lifecycle; no vehicle or companion game edits.', cells: [], errors: [] };
try {
  for (const tier of ['low', 'high']) {
    const session = new SceneSession({ backend: 'webgl2', tier });
    try {
      await session.open();
      const spec = readSpec('tests/scenes/l8-apc/companion.json');
      const entry = vehicleDef('vehicle.military-apc').transport.entry;
      spec.actors.find(a => a.id === 'corgi').at = [entry.x - .4, entry.z];
      spec.script = spec.script.filter(s => s.actor !== 'corgi');
      spec.script.push({ frame: 1, actor: 'corgi', do: { boardCar: 'apc' } }, { frame: 160, actor: 'corgi', do: { exitCar: 'apc' } });
      spec.script.sort((a, b) => a.frame - b.frame);
      await session.load(spec);
      let at = 0;
      for (const frame of [0, 20, 80, 160, 190, 230, 320]) {
        await session.step(frame - at); at = frame; await session.ready();
        const observation = await session.page.evaluate(() => {
          const g = window.__SCENE__.game, w = g.world;
          return { tick: w.tick, corgis: [...w.entities.iterate()].filter(e => e.companion).map(e => ({ id: e.id, hp: e.health.current, hidden: !!e.hidden, passengerOf: e.passengerOf ?? null, at: { ...e.transform } })), vehicles: [...w.entities.iterate()].filter(e => e.vehicle).map(e => ({ id: e.id, state: e.vehicle })), bars: g.view.getState().healthBars };
        });
        const path = `${out}/${tier}-f${frame}.png`; await session.screenshot(path);
        result.cells.push({ tier, frame, entry, observation, metrics: await session.metrics(), capture: { file: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') } });
        console.log(tier, frame, observation.corgis);
      }
      result.errors.push(...session.errors);
    } catch (error) { result.errors.push({ tier, error: String(error) }); }
    finally { await session.close(); }
  }
} finally { stopServer(); writeFileSync('docs/reports/sweep-g/G-19-apc.json', JSON.stringify(result, null, 2) + '\n'); }
