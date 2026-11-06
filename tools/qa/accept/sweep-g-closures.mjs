/** Additional companion closure/transport poses; fixture setup is explicit. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SceneSession, readSpec, stopServer } from '../../scenelab/session.ts';
import { provenance } from './probe.ts';

const out = 'test-results/sweep-g/G-19-final-closures';
mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Existing production SceneLab metro, service gate, convoy and departure fixtures. Explicit added corgi actor where the fixture omitted it; physical E for the service gate. No gate, boarding, geometry, health or perception edits. Read-only actual poses, bars, gate/transport states and renderer metrics. No full campaign PASS inferred.', cells: [], errors: [] };
const cases = [
 { file: 'tests/scenes/catalog/collision-placement-l5-metro.json', frames: [0, 60, 120, 180, 360, 600] },
 { file: 'tests/scenes/catalog/qa-l6-po-gate.json', frames: [0, 60, 120, 180], dog: [88, 15], interact: true },
 { file: 'tests/scenes/catalog/collision-l4-ride-camera.json', frames: [0, 120, 360, 720], dog: [-59, 44] },
 { file: 'tests/scenes/l7-departure/departure.json', frames: [0, 120, 240, 360, 480, 540, 600, 660, 720, 780, 840, 900, 1000], dog: [-58, 50] },
];
try {
 for (const tier of ['low', 'high']) {
  const s = new SceneSession({ backend: 'webgl2', tier });
  try {
   await s.open();
   for (const entry of cases) {
    try {
     const spec = readSpec(entry.file);
     if (entry.dog) spec.actors = [...spec.actors, { id: 'sweep-corgi', kind: 'corgi', at: entry.dog }];
     spec.frames = Math.max(spec.frames ?? 0, ...entry.frames);
     await s.load(spec);
     let at = 0;
     if (entry.interact) await s.page.keyboard.down('KeyE');
     try {
      for (const frame of entry.frames) {
       await s.step(frame - at); at = frame;
       for (const zoom of [.5, 1.5]) {
        await s.page.evaluate(z => window.__SS__.camera.zoom(z), zoom); await s.ready();
        const observation = await s.page.evaluate(() => {
         const g = window.__SCENE__.game, w = g.world, render = g.view.getState();
         return { tick: w.tick, quality: g.quality.snapshot().tier, backend: render.backend, camera: g.view.view.getState(), healthBars: render.healthBars,
          player: { ...w.entities.get(1).transform }, corgis: [...w.entities.iterate()].filter(e => e.companion).map(e => ({ id: e.id, health: { ...e.health }, hidden: !!e.hidden, passengerOf: e.passengerOf ?? null, transform: { ...e.transform } })),
          l6Gates: w.missions?.state.l6?.gates, missionGates: w.missions?.state.gates, l4: w.missions?.state.l4 && { phase: w.missions.state.l4.phase, seated: w.missions.state.l4.seated },
          departure: w.l7Departure?.state, vehicles: [...w.entities.iterate()].filter(e => e.vehicle).map(e => ({ id: e.id, archetype: e.archetype, transform: { ...e.transform }, vehicle: e.vehicle })) };
        });
        if (!observation.corgis.length) throw Error('Fixture has no companion; excluded from qualification');
        const file = `${out}/${tier}-${spec.name}-f${frame}-z${zoom}.png`;
        await s.screenshot(file);
        const metrics = await s.metrics();
        result.cells.push({ tier, fixture: entry.file, case: spec.name, frame, requestedZoom: zoom, observation, metrics: { collision: metrics.collision, companion: metrics.companion, bodies: metrics.bodies, doors: metrics.doors, shutter: metrics.shutter, log: metrics.log }, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), reviewed: false });
       }
      }
     } finally { if (entry.interact) await s.page.keyboard.up('KeyE'); }
     console.log(tier, spec.name, at);
    } catch (error) { result.errors.push({ tier, fixture: entry.file, error: String(error) }); }
   }
   result.errors.push(...s.errors);
  } finally { await s.close(); }
 }
} finally { stopServer(); writeFileSync('docs/reports/sweep-g/G-19-final-closures.json', JSON.stringify(result, null, 2) + '\n'); }
console.log('cells', result.cells.length, 'errors', result.errors);
process.exitCode = result.errors.length ? 1 : 0;
