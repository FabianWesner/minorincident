/** Same-frame visibility in actual fence, horde and permanent-corpse fixtures. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SceneSession, readSpec, stopServer } from '../../scenelab/session.ts';
import { measureCourierShare } from '../../scenelab/run.ts';
import { provenance } from './probe.ts';
const out = 'test-results/sweep-g/G-07-final-occlusion'; mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Existing fence/gate, complete L7 horde and30 permanent-corpse fixtures. Original actors, scripts, counts/caps retained. Explicit game-camera0.5/1.5 matrix; corpse fixture courier walks into the existing pile as setup. Established same-frame production-depth ID-mask observer; no simulation step between normal/unobstructed redraws. Preserve each original visibility minimum; zero reference pixels is never PASS.', cells: [], errors: [] };
const cases = [
 { file: 'tests/scenes/catalog/seethrough-door-gate.json', frames: [1, 60, 120, 180, 240] },
 { file: 'tests/scenes/l7-encounters/qa-l7-horde-passage.json', frames: [1, 90, 180, 360] },
 { file: 'tests/scenes/catalog/corpse-placement-pile.json', frames: [1, 60, 120, 180], walk: true },
];
try {
 for (const tier of ['low', 'high']) {
  const s = new SceneSession({ backend: 'webgl2', tier });
  try {
   await s.open();
   for (const entry of cases) {
    try {
     const spec = readSpec(entry.file);
     spec.camera = { mode: 'follow', actor: 'courier', zoom: 1.5 };
     if (entry.walk) spec.actors.find(a => a.kind === 'courier').state = { walk: [[0, 0]] };
     await s.load(spec); let at = 0;
     for (const frame of entry.frames) {
      await s.step(frame - at); at = frame;
      for (const zoom of [.5, 1.5]) {
       await s.page.evaluate(z => window.__SS__.camera.zoom(z), zoom); await s.ready();
       const observation = await s.page.evaluate(() => {
        const g = window.__SCENE__.game, w = g.world, p = w.entities.get(1);
        return { tick: w.tick, player: { ...p.transform }, playerHealth: { ...p.health }, hidden: !!p.hidden, camera: g.view.view.getState(), quality: g.quality.snapshot().tier, backend: g.view.getState().backend, livingInfected: [...w.entities.iterate()].filter(e => e.infected && e.health.current > 0).length, corpses: [...w.entities.iterate()].filter(e => e.corpse).length };
       });
       const visibility = await measureCourierShare(s), minimum = spec.expect?.courierVisibleShareMin ?? null;
       const file = `${out}/${tier}-${spec.name}-f${frame}-z${zoom}.png`; await s.screenshot(file);
       result.cells.push({ tier, fixture: entry.file, case: spec.name, frame, requestedZoom: zoom, observation, visibility, originalMinimum: minimum,
        scopedPass: visibility.reference > 0 && visibility.visible > 0 && (minimum === null || visibility.share >= minimum),
        file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), reviewed: false });
      }
     }
     console.log(tier, spec.name, at);
    } catch (error) { result.errors.push({ tier, fixture: entry.file, error: String(error) }); }
   }
   result.errors.push(...s.errors);
  } finally { await s.close(); }
 }
} finally { stopServer(); writeFileSync('docs/reports/sweep-g/G-07-final-occlusion.json', JSON.stringify(result, null, 2) + '\n'); }
console.log('cells', result.cells.length, 'errors', result.errors);
process.exitCode = result.errors.length || result.cells.some(c => !c.scopedPass) ? 1 : 0;
