/** Review-only production motion probe; run under e2e-lock.sh. */
import { SceneSession, stopServer, readSpec, writeJson } from './session';
const root = '/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s53-zombie-review';
const s = new SceneSession({ backend: 'webgpu', tier: 'high' });
const receipts: unknown[] = [];
try {
 await s.open();
 for (const name of ['alpha']) {
 const spec = readSpec(`${root}/heavy-specs/brute.json`);

 const nightPreset = 'night'; spec.actors![0].alphaType = 'brute';
 spec.actors![0].archetype = name === 'alpha' ? 'infected.alpha' : 'infected.bloated'; spec.actors![0].look = { model: `inf.${name}` };
 spec.actors!.push({ id: 'courier', kind: 'courier', at: [4, 0], god: true });
 spec.camera = { mode: 'game', target: 'z', zoom: 1.5 };
 spec.script = [{ frame: 1, actor: 'z', do: name === 'alpha' ? { special: 'alpha.ground-slam', target: 'courier' } : 'chase' }, { frame: 180, actor: 'z', do: { hit: { from: 'courier', amount: 1 } } }, { frame: 240, actor: 'z', do: { corpse: true, ageTicks: 120 } }];
 spec.trace = true;
 await s.load(spec);
 let previous = 0;
 for (const frame of [10, 25, 40, 55, 70]) {
  await s.step(frame - previous); previous = frame;
  for (const time of ['L4', nightPreset] as const) for (const zoom of [1.5, 1]) {
   await s.page.evaluate(({ time, zoom }) => { window.__SCENE__!.setTime(time); window.__SCENE__!.setCamera({ mode: 'game', target: 'z', zoom }); }, { time, zoom });
   const file = `${root}/alpha-slam-captures/${name}/${frame}-${time}-${zoom}.png`;
   await s.screenshot(file);
   receipts.push({ name, frame, time, zoom, file, metrics: await s.metrics() });
  }
 }
 }
} finally { writeJson(`${root}/alpha-slam-captures/receipts.json`, receipts); await s.close(); stopServer(); }
