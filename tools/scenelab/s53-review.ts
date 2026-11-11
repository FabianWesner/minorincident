/** Review-only production motion probe; run under e2e-lock.sh. */
import { SceneSession, stopServer, readSpec, writeJson } from './session';
const root = '/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s53-zombie-review';
const s = new SceneSession({ backend: 'webgpu', tier: 'high' });
const receipts: unknown[] = [];
try {
 await s.open();
 for (const name of ['mega-alpha', 'mega-alpha-ashen', 'mega-alpha-ember', 'dog']) {
 const spec = readSpec(`${root}/heavy-specs/brute.json`);

 const nightPreset = name === 'dog' ? 'L8-zoo' : 'L10-night';
 spec.actors![0].archetype = name === 'dog' ? 'infected.dog' : 'infected.alpha'; spec.actors![0].look = { model: `inf.${name}` };
 spec.actors!.push({ id: 'courier', kind: 'courier', at: [4, 0], god: true });
 spec.camera = { mode: 'game', target: 'z', zoom: 1.5 };
 spec.script = [{ frame: 5, actor: 'z', do: 'chase' }, { frame: 180, actor: 'z', do: { hit: { from: 'courier', amount: 1 } } }, { frame: 240, actor: 'z', do: { corpse: true, ageTicks: 120 } }];
 spec.trace = true;
 await s.load(spec);
 let previous = 0;
 for (const frame of [1, 30, 90, 130, 185, 245]) {
  await s.step(frame - previous); previous = frame;
  for (const time of ['L4', nightPreset] as const) for (const zoom of [1.5, 1]) {
   await s.page.evaluate(({ time, zoom }) => { window.__SCENE__!.setTime(time); window.__SCENE__!.setCamera({ mode: 'game', target: 'z', zoom }); }, { time, zoom });
   const file = `${root}/motion-mega-dog-matrix/${name}/${frame}-${time}-${zoom}.png`;
   await s.screenshot(file);
   receipts.push({ name, frame, time, zoom, file, metrics: await s.metrics() });
  }
 }
 }
} finally { writeJson(`${root}/motion-mega-dog-matrix/receipts.json`, receipts); await s.close(); stopServer(); }
