import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { survivor } from '../../src/data/survivor';
import { l4 } from '../../src/data/l4';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/** PO #17/#17b: preserve the war; measure actual player engagements after Fall back, through arrival at safety. */
const traces = new Map<string, Promise<Awaited<ReturnType<typeof trace>>>>();
function measured(tier: 'high' | 'low') {
  let result = traces.get(tier);
  if (!result) { result = trace(tier); traces.set(tier, result); }
  return result;
}
async function trace(tier: 'high' | 'low') {
  const { world: w, mission: m } = await loadL4(1, tier);
  try {
    const engaged = new Set<number>(), bins = new Map<number, Set<number>>();
    let start = 0, end = 0, peak = 0, metres = 0, last: { x: number; z: number } | undefined;
    const run = runL4(w, m, 'newbie', { maxSeconds: 700, stopWhen: () => {
      const s = m.state.l4!;
      if (s.phase !== 'collapse') return false;
      start ||= w.tick; end = w.tick;
      const p = w.entities.get(1)!.transform;
      if (last) metres += Math.hypot(p.x - last.x, p.z - last.z);
      last = { x: p.x, z: p.z };
      const bucket = Math.floor((w.tick - start) / 900), ids = bins.get(bucket) ?? new Set<number>(); bins.set(bucket, ids);
      for (const e of w.infected!.active) {
        const b = e.infected?.l1;
        if (e.health.current > 0 && !e.hidden && b?.targetId === 1 && (b.mode === 'chase' || b.mode === 'bite') && Math.hypot(p.x - e.transform.x, p.z - e.transform.z) < 16 && w.infected!.nav.visible(p, e.transform, 0)) { engaged.add(e.id); ids.add(e.id); }
      }
      peak = Math.max(peak, w.infected!.director.count);
      return false;
    } });
    const route = l4.finale?.route ?? l4.director.escape.route, nav = w.infected!.nav;
    let routeMetres = 0;
    for (let i = 1; i < route.length; i++) {
      const path: number[] = [], a = route[i - 1], b = route[i];
      expect(nav.path(nav.nearestCell(a[0], a[1]), nav.nearestCell(b[0], b[1]), path, 400000)).toBe(true);
      for (let k = 1; k < path.length; k++) routeMetres += Math.hypot(nav.x(path[k]) - nav.x(path[k - 1]), nav.z(path[k]) - nav.z(path[k - 1]));
    }
    const seconds = (end - start) / 60, report = { tier, seconds, metres, routeMetres, walkingSeconds: routeMetres / survivor.walkSpeed, engaged: engaged.size, perMinute: engaged.size * 60 / seconds, bins15s: [...bins.values()].map(ids => ids.size), peak, outcome: run.outcome, deaths: run.deaths, totalSeconds: run.simSeconds, door: m.def.anchors['l4-cellar-door'] };
    const dir = process.env.FINALE_REPORT_DIR ?? 'test-results/finale-stretches';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/l4-${tier}.json`, JSON.stringify(report, null, 2));
    console.log('L4 finale', report);
    return report;
  } finally { w.dispose(); }
}
test('PO #17 @E22 the collapse walk has steady sight-driven action and preserves the newbie death limit and E18 cap', async () => {
  const results = [];
  for (const tier of ['high', 'low'] as const) results.push(await measured(tier));
  for (const r of results) {
    const tier = r.tier;
    expect(r.outcome).toBe('complete'); expect(r.deaths).toBeLessThanOrEqual(2);
    expect(r.peak).toBeLessThanOrEqual(l4.war.caps.infected[tier]);
    expect(r.perMinute).toBeGreaterThanOrEqual(tier === 'high' ? 8 : 5);
    expect(r.bins15s.filter(n => n > 0).length).toBeGreaterThanOrEqual(Math.ceil(r.bins15s.length * .7));
  }
}, 1_800_000);
test('PO #17b @E22 the route to the farther cellar lasts two to three minutes through Fairhaven', async () => {
  const results = [];
  for (const tier of ['high', 'low'] as const) results.push(await measured(tier));
  for (const r of results) {
    expect(r.walkingSeconds).toBeGreaterThanOrEqual(120); expect(r.walkingSeconds).toBeLessThanOrEqual(180);
    expect(r.routeMetres).toBeGreaterThanOrEqual(250);
  }
}, 1_800_000);
