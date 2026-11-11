/** Review-only production motion probe; run under e2e-lock.sh. */
import { SceneSession, stopServer, readSpec, writeJson } from './session';
const root = '/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s53-zombie-review';
const s = new SceneSession({ backend: 'webgpu', tier: 'high' });
const receipts: unknown[] = [];
try {
 await s.open();
 for (const name of ['alpha', 'alpha-worker', 'alpha-hoodie', 'alpha-suit', 'alpha-fire']) {
 const spec = readSpec(`${root}/alpha-specs/${name}.json`);
 spec.actors!.push({ id: 'courier', kind: 'courier', at: [4, 0], god: true });
 spec.camera = { mode: 'game', target: 'z', zoom: 1.5 };
 spec.script = [{ frame: 5, actor: 'z', do: 'chase' }, { frame: 180, actor: 'z', do: { hit: { from: 'courier', amount: 1 } } }, { frame: 240, actor: 'z', do: { corpse: true, ageTicks: 120 } }];
 spec.trace = true;
 await s.load(spec);
 let previous = 0;
 for (const frame of [1, 30, 90, 130, 185, 245]) {
  await s.step(frame - previous); previous = frame;
  const file = `${root}/motion-alphas/${name}/shot-${frame}.png`;
  await s.screenshot(file);
  receipts.push({ name, frame, file, metrics: await s.metrics() });
 }
 }
} finally { writeJson(`${root}/motion-alphas/receipts.json`, receipts); await s.close(); stopServer(); }
