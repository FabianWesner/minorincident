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
let passed = true;
try {
  await session.open();
  for (const file of process.env.ONLY_STATES === '1' ? [] : ['specs/scenes/qa-handover-depot.json', 'specs/scenes/qa-handover-annex.json', 'specs/scenes/catalog/fight-firefighter-vs2.json', 'tests/scenes/catalog/corgi-tongue-female.json', 'tests/scenes/catalog/corgi-tongue-male.json', 'tests/scenes/catalog/dog-limbs-attached.json', 'specs/scenes/catalog/corgi-sit.json', 'specs/scenes/catalog/corgi-behaviour.json', 'specs/scenes/catalog/dog-bike-follow.json']) {
    const spec = readSpec(resolve(file));
    // Full size shots retain the actual game view; the labelled sheet samples the complete choreography.
    const result = await runSpec(session, spec, { file, out: resolve(out, spec.name!), sheet: spec.name!.includes('handover') ? 60 : spec.sheet ?? 60 });
    receipts.push({ file, ...result });
    writeJson(resolve(out, 'receipts.json'), receipts);
    if (!result.pass) { console.error(`${spec.name}: ${JSON.stringify(result.failed)}`); passed = false; }
  }
  for (const model of process.env.STATE_FIGURES?.split(',') ?? [...pedestrians, ...named]) for (const state of ['healthy', 'turned', 'corpse']) {
    const spec: SceneSpec = {
      name: `${model}-${state}`, ground: 'asphalt', time: 'L1', size: 100,
      actors: [
        { id: 'courier', kind: 'courier', at: [40, 40] },
        { id: 'figure', kind: 'pedestrian', at: [0, 0], yaw: -45, look: { model, handProp: model === 'npc.civilian-elderly' ? 'cane' : null }, state: 'idle' },
      ],
      script: [
        ...state !== 'healthy' ? [{ frame: 1, actor: 'figure', do: { infect: { instant: true } } }] : [],
        ...state === 'corpse' ? [{ frame: 2, actor: 'figure', do: { corpse: true as const } }] : [],
        { frame: 179, camera: { mode: 'close', target: 'figure', radius: 6, azimuth: 45 } },
      ],
      camera: { mode: 'close', target: [0, .75, 0], radius: 6, azimuth: 45 },
      frames: 180, shots: [0, 3, 180], expect: { consoleErrors: 0 },
    };
    const result = await runSpec(session, spec, { out: resolve(out, spec.name!) });
    receipts.push({ model, state, ...result }); writeJson(resolve(out, 'receipts.json'), receipts);
    assert.ok(result.pass, `${spec.name}: ${JSON.stringify(result.failed)}`);
  }
} finally { await session.close(); stopServer(); }
console.log(JSON.stringify(receipts));
assert.ok(passed, 'Inspect failed scene receipts, including baseline comparisons');
