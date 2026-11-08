/** Gate boundary fixture, plus separate ordinary mortal breach/abandon event probe. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { relocatePlayer } from '../../src/sim/missions/missionHelpers';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel, runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L6-default'); campaign.settings.quality = tier;
  const w = await loadLevel('L6', 1, campaign, 0, { quality: tier });
  const gates = [];
  try {
    const m = w.missions!, s = m.state.l6!;
    m.completeObjective('shelter'); m.completeObjective('stop');
    const controller = m.l6! as unknown as { closable(g: typeof s.gates[number]): boolean; guide(p: { x: number; z: number }): void; gateStatus(id: number): string };
    for (const gate of s.gates) {
      for (const [i, r] of s.survivors.entries()) {
        const e = w.entities.get(r.id)!; r.status = 'following';
        Object.assign(e.transform, { x: gate.x + 5 + i * .8, z: 15, y: 1.3 });
        w.solids.forget(e); w.spatial.set(e.id, e.transform.x, e.transform.z);
      }
      const near = w.entities.get(s.survivors[0].id)!, original = { ...near.transform };
      const boundaries = [-1.99, 0, 1.8, 2, 2.01].map(delta => {
        near.transform.x = gate.x + delta;
        const closable = controller.closable(gate); assert.equal(closable, delta > 2);
        return { survivorOffsetM: delta, closable, status: controller.gateStatus(gate.id) };
      });
      Object.assign(near.transform, original);
      const markerSamples = [];
      for (const p of [{ x: gate.x + 2.4, z: 17.3 }, { x: gate.x + 3.5, z: 16.5 }, { x: gate.x + 2.4, z: 17.3 }]) {
        relocatePlayer(w, p.x, p.z); controller.guide(p);
        const at = m.def.anchors['l6-next'];
        assert.equal(at.x, gate.x + 2.4); assert.equal(at.z, 17.3);
        markerSamples.push({ player: p, marker: m.state.marker, at: { ...at }, prompt: controller.gateStatus(gate.id), closedAt: gate.closedAt });
      }
      gates.push({ x: gate.x, boundaries, markerSamples });
    }
  } finally { w.dispose(); }
  const events: unknown[] = [], powers: unknown[] = [];
  let observedHash = '';
  const run = await runLevel('L6', 'complete', 1, 80, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
    for (const type of ['l6.breach1', 'l6.breach2', 'power.off', 'l6.abandon'] as const) world.events.on(type, event => {
      const s = world.missions!.state.l6!;
      events.push({ ...event, mainPower: s.mainPower, emergency: s.emergency,
        lightGroups: [...world.districts!.districts[0].decay.lights],
        roster: event.type === 'l6.abandon' ? s.survivors.map(r => ({ id: r.id, status: r.status, infected: !!world.entities.get(r.id)?.infected, infection: !!world.entities.get(r.id)?.infection })) : undefined });
    });
    world.events.on('sim.tick', () => {
      const s = world.missions!.state.l6!;
      if (s.phase === 'fails' && powers.length < 2) powers.push({ tick: world.tick, mainPower: s.mainPower, emergency: s.emergency, lightGroups: [...world.districts!.districts[0].decay.lights] });
    }, 8);
  }, beforeDispose: world => { observedHash = stateHash(world.getState()); } });
  let controlHash = '';
  await runLevel('L6', 'complete', 1, 80, 'auto', campaign, undefined, 0, { quality: tier, beforeDispose: world => { controlHash = stateHash(world.getState()); } });
  assert.equal(observedHash, controlHash);
  rows.push({ tier, controlledGates: gates, ordinaryProbe: { run, events, powers, observedHash, controlHash } });
  console.log(tier, 'gate boundaries and80s ordinary control identical');
}
writeFileSync(process.env.L6_VISUAL_NATIVE_OUT ?? 'docs/reports/sweep-b/L6-controls.json', JSON.stringify({ ...identity,
  producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-controls.ts')).digest('hex'),
  method: 'Gate fixture explicitly completes shelter/stop and places the existing roster beyond each gate; production closable/guide/gateStatus methods exercised at the unchanged2m boundary and three courier positions. Separate80s ordinary mortal complete policy observes actual breach/power/abandon events, with an independent no-observer80s final-state control. No full-route claim from this bounded probe.', rows }, null, 2) + '\n');
