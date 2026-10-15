import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l2 } from '../../src/data/l2';
import { followFrustum } from '../../tools/sim-runner/l3Bots';
import { loadL2, runL2 } from '../../tools/sim-runner/l2Bots';

/** PO #7/#7b: walk away from the supermarket, then arrive at the bridge with a live fight. */
const traces = new Map<string, Promise<Awaited<ReturnType<typeof trace>>>>();
function measured(tier: 'high' | 'low', opening: 'direct' | 'side' = 'direct') {
  const key = `${tier}-${opening}`;
  let result = traces.get(key);
  if (!result) { result = trace(tier, opening); traces.set(key, result); }
  return result;
}
async function trace(tier: 'high' | 'low', opening: 'direct' | 'side') {
  const { world: w, mission: m } = await loadL2(1, tier);
  try {
    const engaged = new Set<number>(), streetEngaged = new Set<number>(), policeTargets = new Set<number>(), bins = new Map<number, Set<number>>();
    let start = 0, end = 0, peak = 0;
    // Engagement includes rescuing a civilian by fighting their attacker, as well as an infected pursuing the courier.
    const engage = (id: number) => {
      const state = m.state.l2!; if (!state.radioAt || state.crossedAt) return;
      start ||= w.tick; end = w.tick; engaged.add(id);
      if (state.escapeIds.includes(id)) streetEngaged.add(id);
      const bucket = Math.floor((w.tick - start) / 900), ids = bins.get(bucket) ?? new Set<number>(); ids.add(id); bins.set(bucket, ids);
    };
    w.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit' || e.sourceId !== 1) return;
      const target = w.entities.get(e.targetId), p = w.entities.get(1)!.transform;
      if (target?.infected && Math.hypot(p.x - target.transform.x, p.z - target.transform.z) < 16 && w.infected!.nav.visible(p, target.transform, 0)) engage(target.id);
    });
    w.events.on('ally.attack', e => {
      if (e.type !== 'ally.attack' || !m.state.l2!.officerIds.includes(e.sourceId)) return;
      const p = w.entities.get(1)!.transform, officer = w.entities.get(e.sourceId)!;
      const target = w.entities.get(e.targetId);
      if (m.state.l2!.radioAt && Math.hypot(p.x - l2.checkpoint.gateX, p.z - 30) < 12 && target
        && w.infected!.director.visible(officer.transform) && w.infected!.director.visible(target.transform)) policeTargets.add(e.targetId);
    });
    const run = runL2(w, m, 'newbie', { maxSeconds: 360, opening, stopWhen: () => {
      followFrustum(w);
      const s = m.state.l2!;
      if (!s.radioAt || s.crossedAt) return false;
      start ||= w.tick; end = w.tick;
      const p = w.entities.get(1)!.transform, bucket = Math.floor((w.tick - start) / 900);
      const ids = bins.get(bucket) ?? new Set<number>(); bins.set(bucket, ids);
      for (const e of w.infected!.active) {
        const b = e.infected?.l1;
        if (e.health.current > 0 && !e.hidden && b?.targetId === 1 && (b.mode === 'chase' || b.mode === 'bite') && Math.hypot(p.x - e.transform.x, p.z - e.transform.z) < 16 && w.infected!.nav.visible(p, e.transform, 0)) { engage(e.id); }
      }
      peak = Math.max(peak, w.infected!.director.count);
      return false;
    } });
    const seconds = (end - start) / 60, report = { tier, opening, seconds, streetEngaged: streetEngaged.size, streetPerMinute: streetEngaged.size * 60 / seconds, engaged: engaged.size, perMinute: engaged.size * 60 / seconds, bins15s: [...bins.values()].map(ids => ids.size), policeTargets: policeTargets.size, peak, outcome: run.outcome, deaths: run.deaths, deathsAt: run.deathsAt, totalSeconds: run.simSeconds, prefix: run.timeline.filter(e => ['l2.alarm', 'l2.truckDeparted', 'l2.truckArrived', 'l2.doorsOpen'].includes(e.type)) };
    const dir = process.env.FINALE_REPORT_DIR ?? 'test-results/finale-stretches';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/l2-${tier}-${opening}.json`, JSON.stringify(report, null, 2));
    console.log('L2 finale', report);
    return report;
  } finally { w.dispose(); }
}
test('PO #7 @E20 supermarket to bridge has steady sight-driven action, an open escape and unchanged newbie survival', async () => {
  const results = [];
  for (const tier of ['high', 'low'] as const) results.push(await measured(tier));
  for (const r of results) {
    const tier = r.tier;
    expect(r.outcome).toBe('complete'); expect(r.deaths).toBeLessThanOrEqual(1);
    expect(r.peak).toBeLessThanOrEqual(l2.escape.caps[tier]);
    expect(r.perMinute).toBeGreaterThanOrEqual(tier === 'high' ? 8 : 5);
    expect(r.streetPerMinute, 'street population, excluding the market pursuers and bridge cluster').toBeGreaterThanOrEqual(tier === 'high' ? 8 : 5);
    expect(r.bins15s.filter(n => n > 0).length).toBeGreaterThanOrEqual(Math.ceil(r.bins15s.length * .7));
  }
}, 1_800_000);
test('PO #7b @E20 the arriving player sees police firing on a horde at the bridge', async () => {
  const results = [];
  for (const tier of ['high', 'low'] as const) results.push(await measured(tier, 'side'));
  for (const r of results) expect(r.policeTargets).toBeGreaterThanOrEqual(4);
}, 1_800_000);
