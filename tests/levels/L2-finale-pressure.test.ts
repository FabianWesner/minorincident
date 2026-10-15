import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l2 } from '../../src/data/l2';
import { loadL2, runL2 } from '../../tools/sim-runner/l2Bots';

/** PO #7/#7b: walk away from the supermarket, then arrive at the bridge with a live fight. */
const traces = new Map<string, Promise<Awaited<ReturnType<typeof trace>>>>();
function measured(tier: 'high' | 'low') {
  let result = traces.get(tier);
  if (!result) { result = trace(tier); traces.set(tier, result); }
  return result;
}
async function trace(tier: 'high' | 'low') {
  const { world: w, mission: m } = await loadL2(1, tier);
  try {
    const engaged = new Set<number>(), policeTargets = new Set<number>(), bins = new Map<number, Set<number>>();
    let start = 0, end = 0, peak = 0;
    w.events.on('ally.attack', e => {
      if (e.type !== 'ally.attack' || !m.state.l2!.officerIds.includes(e.sourceId)) return;
      const p = w.entities.get(1)!.transform, officer = w.entities.get(e.sourceId)!;
      if (m.state.l2!.radioAt && Math.hypot(p.x - officer.transform.x, p.z - officer.transform.z) < 24 && e.targetId) policeTargets.add(e.targetId);
    });
    const run = runL2(w, m, 'newbie', { maxSeconds: 360, opening: 'direct', stopWhen: () => {
      const s = m.state.l2!;
      if (!s.radioAt || s.crossedAt) return false;
      start ||= w.tick; end = w.tick;
      const p = w.entities.get(1)!.transform, bucket = Math.floor((w.tick - start) / 900);
      const ids = bins.get(bucket) ?? new Set<number>(); bins.set(bucket, ids);
      for (const e of w.infected!.active) {
        const b = e.infected?.l1;
        if (e.health.current > 0 && !e.hidden && b?.targetId === 1 && (b.mode === 'chase' || b.mode === 'bite') && Math.hypot(p.x - e.transform.x, p.z - e.transform.z) < 16 && w.infected!.nav.visible(p, e.transform, 0)) { engaged.add(e.id); ids.add(e.id); }
      }
      peak = Math.max(peak, w.infected!.director.count);
      return false;
    } });
    const seconds = (end - start) / 60, report = { tier, seconds, engaged: engaged.size, perMinute: engaged.size * 60 / seconds, bins15s: [...bins.values()].map(ids => ids.size), policeTargets: policeTargets.size, peak, outcome: run.outcome, deaths: run.deaths, totalSeconds: run.simSeconds };
    const dir = process.env.FINALE_REPORT_DIR ?? 'test-results/finale-stretches';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/l2-${tier}.json`, JSON.stringify(report, null, 2));
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
    expect(r.bins15s.filter(n => n > 0).length).toBeGreaterThanOrEqual(Math.ceil(r.bins15s.length * .7));
  }
}, 1_800_000);
test('PO #7b @E20 the arriving player sees police firing on a horde at the bridge', async () => {
  for (const tier of ['high', 'low'] as const) expect((await measured(tier)).policeTargets).toBeGreaterThanOrEqual(4);
}, 1_800_000);
