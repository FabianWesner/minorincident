/** fix-reveal (Q-50/Q-229/Q-241): reveal spots at low/high × zoom 1/1.5, one PNG per cell, for before/after review. Shared headless pool only.
 * SCENE_PORT=33971 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/fix-reveal-scenes.ts <label> [filter] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const label = process.argv[2] ?? 'before', filter = process.argv[3];
const backend = process.env.TRIAGE_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu';
const out = resolve(`test-results/fix-reveal/${label}`);
const at = (spec: SceneSpec, name: string, x: number, z: number, frames = 30): SceneSpec => ({ ...spec, name, actors: spec.actors!.map(a => a.id === 'courier' ? { ...a, at: [x, z] as [number, number], state: 'idle' } : a), camera: { mode: 'game', target: [x, z] }, frames, shots: [frames - 1] });
const tent = readSpec(resolve('specs/scenes/catalog/l4-tent-flush.json'));
const plaza: SceneSpec = { ...tent, layout: { level: 'L4', district: 'D-FAIR', bbox: [[-58, -38], [14, 44]] } };
const tunnel = readSpec(resolve('tests/scenes/catalog/l6-tunnel-walkway.json'));
const specs: SceneSpec[] = [
  // Q-229: the courier just behind a reception tent (north, away from the camera), behind the east tent and at a back corner.
  at(tent, 'l4-tent-behind', -26.8, 14.6), at(tent, 'l4-tent-behind-east', -22.8, 14.7), at(tent, 'l4-tent-gap-back', -24.8, 11.6), at(tent, 'l4-tent-corner', -24.9, 14.4),
  // Q-229: behind the reception plaza's field tents and triage gazebo (kit.reception-plaza at -26, -8.8).
  at(plaza, 'l4-plaza-tent-n', -32.6, -13.4), at(plaza, 'l4-plaza-tent-s', -32.6, -6.6), at(plaza, 'l4-plaza-gazebo-n', -24.6, -13.6), at(plaza, 'l4-plaza-gazebo-s', -24.6, -6.4), at(plaza, 'l4-plaza-aisle', -27.5, -8.8),
  // Q-241: the L6 tunnel arches at the walkway and the retreat track.
  { ...tunnel, name: 'l6-tunnel-walkway', shots: [75] },
  ...['seethrough-behind-building-l4', 'seethrough-l5-supermarket-beside', 'interior-cull-reveal-l5', 'seethrough-not-in-the-way', 'seethrough-companion-clean-z1', 'qa-l6-shelter-reveal', 'seethrough-door-gate']
    .map(name => readSpec(resolve(`${name === 'seethrough-behind-building-l4' ? 'specs' : 'tests'}/scenes/catalog/${name}.json`))),
].filter(s => !filter || s.name!.includes(filter));
const receipt: Record<string, unknown> = {};
for (const tier of ['low', 'high'] as const) {
  const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
  try {
    for (const spec of specs) for (const zoom of [1, 1.5]) {
      const cell = { ...spec, camera: { ...spec.camera, zoom } as SceneSpec['camera'], sheet: 0, video: 0 };
      const dir = `${out}/${spec.name}-${tier}-z${zoom}`; mkdirSync(dir, { recursive: true });
      await session.open();
      const result = await runSpec(session, cell, { out: dir }).catch((e: Error) => ({ pass: false, error: e.message.split('\n')[0] }));
      if ('error' in result) { receipt[`${spec.name}-${tier}-z${zoom}`] = result; await session.close(); continue; }
      receipt[`${spec.name}-${tier}-z${zoom}`] = { pass: result.pass, audit: await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: { view: { districts?: { seeThroughAudit(): unknown } } } }).game.view.districts?.seeThroughAudit()).catch(() => undefined) };
      await session.close();
    }
  } finally { await session.close().catch(() => undefined); }
}
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
stopServer();
