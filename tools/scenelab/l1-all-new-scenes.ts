/** Scripted story scenes and the production crowd's live/turned/corpse appearances. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { pedestrians, named } from './l1-all-new-crowd';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

const out = resolve('test-results/l1-all-new/scenes');
const session = new SceneSession({ backend: 'webgpu', tier: 'low', viewport: { width: 1600, height: 900 }, query: { crowdProbe: 'full' } });
const receipts: unknown[] = [];
try {
  await session.open();
  for (const file of ['specs/scenes/qa-handover-depot.json', 'specs/scenes/qa-handover-annex.json', 'specs/scenes/catalog/fight-firefighter-vs2.json', 'tests/scenes/catalog/corgi-tongue-female.json', 'tests/scenes/catalog/corgi-tongue-male.json', 'tests/scenes/catalog/dog-limbs-attached.json', 'specs/scenes/catalog/corgi-sit.json', 'specs/scenes/catalog/corgi-behaviour.json', 'specs/scenes/catalog/dog-bike-follow.json']) {
    const spec = readSpec(resolve(file));
    // Full size shots retain the actual game view; the labelled sheet samples the complete choreography.
    const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: spec.name!.includes('handover') ? 60 : spec.sheet ?? 60 });
    receipts.push({ file, ...result });
    writeJson(resolve(out, 'receipts.json'), receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
  }
  for (const model of [...pedestrians, ...named]) {
    const spec: SceneSpec = {
      name: `${model}-states`, ground: 'asphalt', time: 'L1', size: 40,
      actors: [
        { id: 'courier', kind: 'courier', at: [-15, 15] },
        ...['healthy', 'turned', 'corpse'].map((id, i) => ({ id, kind: 'pedestrian' as const, at: [i * 2.5 - 2.5, 0] as [number, number], yaw: -45, look: { model, handProp: model === 'npc.civilian-elderly' ? 'cane' : null }, state: 'idle' as const })),
      ],
      script: [
        { frame: 1, actor: 'turned', do: { infect: { instant: true } } },
        { frame: 1, actor: 'corpse', do: { infect: { instant: true } } },
        { frame: 2, actor: 'corpse', do: { corpse: true } },
      ],
      camera: { mode: 'close', target: [0, .75, 0], radius: 8, azimuth: 45 },
      frames: 3, shots: [0, 3], expect: { consoleErrors: 0 },
    };
    const result = await runSpec(session, spec, { out: resolve(out, spec.name!) });
    receipts.push({ model, ...result }); writeJson(resolve(out, 'receipts.json'), receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
  }
} finally { await session.close(); stopServer(); }
console.log(JSON.stringify(receipts));
