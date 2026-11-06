/** Current actual spawn positions reconciled against accepted authored cohorts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { l5, l5Survivors, l5Wanderers } from '../../src/data/l5';
import { preset } from '../../src/sim/progression/Campaign';
import { snapToClear } from '../../src/sim/missions/missionHelpers';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L5-default'); campaign.settings.quality = tier;
  const w = await loadLevel('L5', 1, campaign, 0, { quality: tier });
  try {
    const s = w.missions!.state.l5!, nav = w.infected!.nav, anchor = w.missions!.def.anchors;
    const reachable = nav.reachableFrom(nav.startCell(anchor['l5-out'], .45));
    const planned: { x: number; z: number }[] = [], actors = [];
    let cursor = 0;
    for (const [groupIndex, g] of l5Wanderers.entries()) for (let k = 0; k < g.n && cursor < s.infectedIds.length; k++) {
      const raw = { x: g.at[0] + k * 2.5, z: g.at[1] + k * 1.5 };
      if (!g.alpha && !nav.clear(raw.x, raw.z, .45)) continue;
      const p = snapToClear(w, raw, g.alpha ? .8 : .45);
      if (!g.alpha && p.x > -66 && p.x < -40 && p.z > -34 && p.z < 40) continue;
      if (g.spread && (!reachable[nav.startCell(p, .45)] || planned.some(v => Math.hypot(v.x - p.x, v.z - p.z) < 4) || l5Survivors.some(v => Math.hypot(anchor[`l5-ring-${v.key}`].x - p.x, anchor[`l5-ring-${v.key}`].z - p.z) < 4) || Math.hypot(anchor['l5-out'].x - p.x, anchor['l5-out'].z - p.z) < 15)) continue;
      const id = s.infectedIds[cursor++], e = w.entities.get(id)!;
      assert(e.infected); assert.equal(e.health.current > 0, true);
      const home = e.infected.l1;
      if (home) assert(Math.hypot(home.homeX - e.transform.x, home.homeZ - e.transform.z) < 1e-8);
      assert(Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 6);
      // Production admission may move a centre around another body; retain both
      // requested and admitted positions, without replacing the actual census.
      actors.push({ id, groupIndex, authoredGroupCount: g.n, spread: !!g.spread, alpha: !!g.alpha, requested: p, admitted: { ...e.transform }, admissionShiftM: Math.hypot(e.transform.x - p.x, e.transform.z - p.z) });
      planned.push(p);
    }
    assert.equal(cursor, s.infectedIds.length);
    const centers = [-50, -37.4, -24, -12, 2, 14, 28, 43.6];
    const columns = [-68, -56, -40, -26, -12, 2, 14, 28, 44, 58, 66];
    const nearest = (v: number, options: number[]) => options.reduce((a, b) => Math.abs(v - a) <= Math.abs(v - b) ? a : b);
    const bands = centers.map(z => ({ z, ids: actors.filter(e => nearest(e.admitted.z, centers) === z).map(e => e.id) }));
    const streetColumns = columns.map(x => ({ x, ids: actors.filter(e => nearest(e.admitted.x, columns) === x).map(e => e.id) }));
    const groups = [...new Set(actors.map(e => e.groupIndex))].map(groupIndex => ({ groupIndex, ids: actors.filter(e => e.groupIndex === groupIndex).map(e => e.id) }));
    const initialCount = actors.length, target = l5.infected.start[tier], maximumGroup = Math.max(...groups.map(g => g.ids.length));
    const pass = initialCount >= target && maximumGroup <= 3 && bands.every(b => b.ids.length > 0) && streetColumns.every(b => b.ids.length > 0);
    rows.push({ tier, initialCount, target, maximumGroup, bands, streetColumns, groups, actors, pass, stateHash: stateHash(w.getState()) });
    console.log(tier, initialCount, maximumGroup, bands.map(b => b.ids.length), pass);
  } finally { w.dispose(); }
}
writeFileSync('docs/reports/sweep-b/L5-census.json', JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l5-census.ts')).digest('hex'), method: 'Actual initial living infected IDs and admitted transforms, before any input/tick. Read-only deterministic placement replay associates accepted source cohorts using the same static navigation and rejection rules; each actual actor/home position is retained alongside requested placement. Actual positions are assigned to the nearest authored street row and column, so every city band is represented without a fabricated3m road width. Cohort size uses actual IDs from that cohort, no visual clustering threshold. Source quotas100/150 are stricter than the row minimum60/90.', rows }, null, 2) + '\n');
