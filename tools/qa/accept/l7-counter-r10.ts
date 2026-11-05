import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { objectiveText } from '../../../src/sim/missions/objectiveText';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L7-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const campaign = preset('L7-default'); campaign.settings.quality = tier;
  let samples = 0, mismatches = 0, movingMarkers = 0, finalHash = '';
  const values: { tick: number; near: number; total: number; text: string; marker: string | null; anchor: { x: number; y: number | undefined; z: number } | null }[] = [];
  let expectedAnchor: { x: number; y: number | undefined; z: number } | null = null;
  const run = await runLevel('L7', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const anchor = world.missions!.def.anchors['l7-corridor-east'];
      expectedAnchor = { x: anchor.x, y: anchor.y, z: anchor.z };
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const mission = world.missions!;
        if (mission.state.steps.corridor?.status !== 'active' || mission.state.phase !== 'playing') return;
        const player = world.entities.get(1)!;
        const live = world.l7Encounters!.state.roster.filter(person => {
          const actor = world.entities.get(person.id);
          return actor && actor.health.current > 0 && !actor.infected && !actor.infection && actor.civilian?.survivor?.mode === 'follow';
        });
        const near = live.filter(person => { const actor = world.entities.get(person.id)!; return Math.hypot(actor.transform.x - player.transform.x, actor.transform.z - player.transform.z) <= 18; }).length;
        const text = objectiveText(mission, 'Bring the group to the evacuation corridor');
        samples++;
        if (!text.includes(`Group ${near}/${live.length} nearby`)) mismatches++;
        const anchor = mission.state.marker ? mission.def.anchors[mission.state.marker] : null;
        if (mission.state.marker !== 'l7-corridor-east' || !anchor || anchor.x !== expectedAnchor!.x || anchor.y !== expectedAnchor!.y || anchor.z !== expectedAnchor!.z) movingMarkers++;
        if (world.tick % 60 === 0) values.push({ tick: world.tick, near, total: live.length, text, marker: mission.state.marker, anchor: anchor ? { x: anchor.x, y: anchor.y, z: anchor.z } : null });
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash, 'counter observation must leave the native control identical');
  rows.push({ tier, samples, mismatches, movingMarkers, expectedAnchor, nativeStateHash: finalHash, controlIdentical: true, values });
}
atomicJson('docs/reports/fix51-verify/receipts/L7-counter.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Every active corridor tick on both ordinary competent native routes: production HUD objective string versus an independent roster/18m distance census; fixed marker identity and exact destination x/y/z; no input, actor or RNG changes; native control state identical.', rows });
console.log(rows.map(row => ({ tier: row.tier, samples: row.samples, mismatches: row.mismatches, movingMarkers: row.movingMarkers, controlIdentical: row.controlIdentical })));
