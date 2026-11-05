/** Whole-route regression for L2 street admission, with ordinary mortal inputs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inCheckpointZone, loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';
import { ThreatObserver } from './threat/observer';
const rows = [];
const identity = provenance();
for (const tier of ['low', 'high'] as const) for (const profile of ['no-axe', 'complete'] as const) {
  const { world, mission } = await loadL2(1, tier);
  const threat = new ThreatObserver(world, 'L2');
  let maxLiving = 0, overflowTicks = 0;
  let closureIds: number[] | null = null, previousInside = new Set<number>(), previousAlive = new Set<number>();
  const crossingLedger: { tick: number; id: number }[] = [], newInside: { tick: number; id: number }[] = [];
  const retirements: { tick: number; id: number; phase: string; offscreen: boolean; recoverAt: number; mode: string | undefined; target: number | undefined; distanceM: number }[] = [];
  const ai = world.infected!, release = ai.release.bind(ai);
  ai.release = e => {
    if (e.health.current > 0) retirements.push({ tick: world.tick, id: e.id, phase: mission.state.l2!.phase,
      offscreen: ai.director.offscreen(e.transform, e.transform.y - .7), recoverAt: e.infected!.recoverAt,
      mode: e.infected?.l1?.mode, target: e.infected?.l1?.targetId,
      distanceM: Math.hypot(e.transform.x - world.entities.get(1)!.transform.x, e.transform.z - world.entities.get(1)!.transform.z) });
    release(e);
  };
  const off = world.events.on('sim.tick', () => {
    const living = ai.active.filter(e => e.health.current > 0), s = mission.state.l2!;
    const inside = new Set(living.filter(e => inCheckpointZone(e.transform)).map(e => e.id));
    if (s.gateClosedAt) {
      closureIds ??= [...inside];
      if (world.tick > s.gateClosedAt) for (const id of inside) if (!previousInside.has(id)) {
        (previousAlive.has(id) ? crossingLedger : newInside).push({ tick: world.tick, id });
      }
    }
    previousInside = inside; previousAlive = new Set(living.map(e => e.id));
    const count = living.length;
    maxLiving = Math.max(maxLiving, count); if (count > ai.director.cap) overflowTicks++;
  });
  try {
    const report = runL2(world, mission, profile, { maxSeconds: 600 });
    assert.equal(report.outcome, 'complete'); assert(report.deaths <= 2);
    assert(report.radio && report.radio.escapeArea >= 25 && report.radio.groupsOf4 >= 3 && report.radio.chasingFraction <= .2);
    assert.equal(report.cluster?.atApproach, 13); assert.equal(overflowTicks, 0);
    assert(report.scatteredSingleAdmissions.length >= (tier === 'low' ? 4 : 6));
    assert(retirements.every(e => e.offscreen && e.recoverAt < 0 && e.mode !== 'bite' && e.target !== 1));
    const phases = threat.finish().phases;
    assert.equal(report.gate?.crossingsAfterClosure.length, 0);
    if (profile === 'complete') {
      const bridge = phases.find(p => p.key === 'step/bridge');
      assert(bridge && bridge.attacksPerMinute >= 2 && bridge.attacksPerMinute <= 20);
    }
    const row = { tier, profile, report, phases, maxLiving, cap: ai.director.cap, overflowTicks, retirements, gateLedger: { closureIds, crossingLedger, newInside } };
    rows.push(row); console.log(JSON.stringify({ tier, profile, outcome: report.outcome, deaths: report.deaths, radio: report.radio, cluster: report.cluster, singles: report.scatteredSingleAdmissions.length, maxLiving, overflowTicks, phases: phases.map(p => ({ key: p.key, attacksPerMinute: p.attacksPerMinute })), gateLedger: row.gateLedger }));
  } finally { off(); world.dispose(); }
}
mkdirSync('test-results/fix55-a', { recursive: true });
assert.equal(provenance().sourceHash, identity.sourceHash);
writeFileSync('test-results/fix55-a/L2-11-groups-regression.json', JSON.stringify({ ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), rows }, null, 2) + '\n');
