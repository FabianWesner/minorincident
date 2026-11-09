import { expect, test, vi } from 'vitest';
import { loadLevel } from './world';
import { l4, l4Edges, l4Emergence, l4Route, l4RoutePose, l4ConvoyStations } from '../../../src/data/l4';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';
import { loadLevel as loadTieredLevel } from './world';
import { l5, l5Wanderers } from '../../../src/data/l5';

// The 793be6bd3 AI monkeypatch predates the PO's L6 pressure and L9 redesigns; it is no longer a production baseline.
// Exact authored wave counts remain below and in waves.test.ts. Keep the accepted L5 population contract here.
async function assertL5Population() {
  for (const tier of ['high', 'low'] as const) {
    const world = await loadTieredLevel('L5', 1, tier);
    try {
      const ids = world.missions!.state.l5!.infectedIds, alphas = ids.filter(id => world.entities.get(id)?.archetype === 'infected.alpha');
      expect(world.infected!.director.cap).toBe(l5.infected.cap[tier]);
      expect(l5Wanderers.every(g => g.n <= l5.infected.maxGroup && (!g.spread || g.n === 1))).toBe(true);
      expect(ids).toHaveLength(l5.infected.start[tier]); expect(alphas).toHaveLength(2);
      expect(alphas.every(id => world.entities.get(id)?.health.current === world.entities.get(id)?.health.max)).toBe(true);
      const firstSpread = l5Wanderers.findIndex(g => g.spread), spreadStart = l5Wanderers.slice(0, firstSpread).reduce((n, g) => n + g.n, 0);
      const spread = ids.slice(spreadStart).map(id => world.entities.get(id)!.transform);
      const nav = world.infected!.nav, reachable = nav.reachableFrom(nav.startCell(world.missions!.def.anchors['l5-out'], .45));
      expect(ids.every(id => reachable[nav.startCell(world.entities.get(id)!.transform, .45)])).toBe(true);
      for (const point of spread) for (const survivor of world.missions!.state.l5!.survivors) {
        const ring = world.missions!.def.anchors[`l5-ring-${survivor.key}`];
        // PO rescue-street singles now stand 4.5 m from hiding places; production keeps a four-metre exclusion.
        expect(Math.hypot(point.x - ring.x, point.z - ring.z), `${tier} survivor exclusion`).toBeGreaterThanOrEqual(4);
      }
      for (let i = 0; i < spread.length; i++) for (let j = i + 1; j < spread.length; j++) {
        expect(Math.hypot(spread[i].x - spread[j].x, spread[i].z - spread[j].z), `${tier} scattered infected spacing`).toBeGreaterThanOrEqual(4);
      }
    } finally { world.dispose(); }
  }
}

for (const tier of ['high', 'low'] as const) test(`5 @nightly L4 ${tier}: every authored war wave and collapse batch spawns and reaches its goal area`, async () => {
  const errors: string[] = [];
  // Each finite wave starts from the same authored camp. Reusing a 15-minute immortal battlefield let earlier
  // bites, retreat orders and director beats contaminate later route measurements.
  for (const collapse of [false, true]) for (let wave = 0; wave < (collapse ? 1 : l4.war.waveSize.length); wave++) {
    const w = await loadLevel('L4', 1, tier);
    try {
      const m = w.missions!, s = m.state.l4!;
      const c = m.l4! as unknown as { arrive(): void; turn(): void; waves(): void; checkLineBreak(): void; lineBreak(): void; openGate(): void };
      const route = l4Route(), stations = l4ConvoyStations(route.length);
      for (const [i, id] of s.convoyIds.entries()) Object.assign(w.entities.get(id)!.transform, l4RoutePose(route, stations.end[i]));
      c.arrive();
      const player = w.entities.get(1)!; Object.assign(player.transform, { x: -27, z: 4 });
      w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
      w.combat!.damage.god = true; followFrustum(w); c.turn();
      // This fixture isolates each wave's full lifetime from the story's first-of line-break cancellation.
      // Production wave authoring, queue limits, spawner, admission, obstacles and movement all stay active.
      vi.spyOn(c, 'checkLineBreak').mockImplementation(() => {});
      vi.spyOn(c, 'lineBreak').mockImplementation(() => {});
      // Immortal targets that flee or tactically step out of the camp can hold a whole wave outside the goal forever.
      // Isolate this navigation census from that valid combat interception, as we already isolate it from damage.
      const humans = w.infected!.l1!.humans, all = humans.all.bind(humans), get = humans.get.bind(humans), within = humans.within.bind(humans);
      const inCamp = (id: number) => { const t = w.entities.get(id)?.transform, p = l4.perimeter; return !!t && t.x >= p.x0 && t.x <= p.x1 && t.z >= p.z0 && t.z <= p.z1; };
      vi.spyOn(humans, 'all').mockImplementation(() => all().filter(h => inCamp(h.id)));
      vi.spyOn(humans, 'get').mockImplementation(id => inCamp(id) ? get(id) : undefined);
      vi.spyOn(humans, 'within').mockImplementation((p, r) => within(p, r).filter(h => inCamp(h.id)));

      for (const e of [...w.infected!.active]) w.infected!.release(e);
      s.pend.fill(0); s.emergedIds.length = 0; s.collapseIds.length = 0; s.edgeNext.fill(0);
      s.phase = collapse ? 'collapse' : 'war'; s.wave = wave; s.collapseWaves = wave;
      if (collapse) c.openGate();
      s.waveAt = collapse ? Infinity : w.tick; s.collapseWaveAt = collapse ? w.tick : Infinity;
      // Measure this finite street wave independently of recurring exterior
      // perimeter pressure. Otherwise unrelated recovering bodies can consume its entire
      // low-tier admission budget. Alarm identities have their own census;
      // the full-hold action census measures both populations together.
      s.perimeterAt = Infinity; s.perimeterPending = 0;
      const base = collapse ? l4.war.collapseWaveSize : l4.war.waveSize[wave];
      const n = Math.max(1, Math.ceil(base * (tier === 'low' ? .5 : 1) * (collapse ? 1 : l4.war.waveScale)));
      const ring = l4Edges.length - 1, expected = collapse ? n * l4.war.edgesPerWave : Math.ceil(n * l4.war.edgesPerWave / ring) * ring;
      // Authored group cadence plus the longest emergence approach at walking pace, with a 15 s admission margin.
      const approach = Math.max(...l4Emergence.map(e => Math.hypot(e.at[0] - l4.map.centre.x, e.at[1] - l4.map.centre.z)));
      const deadlineTicks = Math.ceil((Math.ceil(expected / ring / l4.war.group[0]) * l4.war.groupEveryS[1] + approach / 1.6 + 15) * 60);
      c.waves(); s.waveAt = s.collapseWaveAt = Infinity;
      const ids: number[] = [], origins: number[] = [], liveIds = new Set<number>();
      let cursor = 0;
      const admitted = new Set<number>(), reached = new Set<number>();
      const collect = () => {
        // Pool IDs are reused after release; each ledger entry is a distinct authored arrival.
        const ledger = collapse ? s.collapseIds : s.emergedIds;
        while (cursor < ledger.length) {
          const id = ledger[cursor++], origin = s.origin[id];
          if (collapse || origin < l4Emergence.length) { ids.push(id); origins.push(origin); liveIds.add(id); }
        }
      };
      collect();
      const applyDamage = w.combat!.damage.apply.bind(w.combat!.damage);
      // An immortal body can be stagger-locked by gunfire forever before crossing the line. Suppress the hit
      // transaction for the measured identities, including its stagger/knockback, rather than only raising HP.
      vi.spyOn(w.combat!.damage, 'apply').mockImplementation(hit => liveIds.has(hit.targetId) ? 0 : applyDamage(hit));
      for (let tick = 0; tick < deadlineTicks && (ids.length < expected || reached.size < expected); tick++) {
        // Keep the authored target roster alive; this measures arrival routes rather than combat outcomes.
        for (const e of w.entities.iterate()) if (e.civilian && !e.infected) { e.health.current = e.health.max = 1_000_000; delete e.infection; }
        for (const id of liveIds) { const e = w.entities.get(id); if (e) e.health.current = e.health.max = 1_000_000; }
        followFrustum(w); w.update(); collect();
        for (const [arrival, id] of ids.entries()) {
          if (reached.has(arrival)) continue;
          const e = w.entities.get(id); if (!e || e.hidden || e.pendingAdmission || e.infected?.hidden) continue;
          admitted.add(arrival);
          const p = l4.perimeter, at = e.transform;
          if (at.x > p.x0 - 1.5 && at.x < p.x1 + 1.5 && at.z > p.z0 - 1.5 && at.z < p.z1 + 1.5) {
            reached.add(arrival); liveIds.delete(id); w.infected!.release(e); // Free the real cap for the remainder of this wave.
          }
        }
      }
      const name = `L4/${tier}/${collapse ? 'collapse' : `war-${wave}`}`;
      const byBreach = new Array(ring).fill(0);
      if (!collapse) for (const origin of origins) {
        const source = l4Emergence[origin];
        if (source) byBreach[source.edge]++;
      }
      const expectedPerBreach = Math.ceil(n * l4.war.edgesPerWave / ring);
      const breachCounts = byBreach.slice(0, ring);
      console.log(`[qa:invariants] ${name}: authored=${expected} spawned=${ids.length} admitted=${admitted.size} reached=${reached.size}${collapse ? '' : ` per-breach=${breachCounts.join(',')}`}`);
      if (ids.length !== expected) console.log(`[qa:invariants] ${name} queued: ${JSON.stringify({ pend: s.pend, perimeterPending: s.perimeterPending, active: w.infected!.active.filter(e => e.health.current > 0).map(e => ({ id: e.id, origin: s.origin[e.id], pending: e.pendingAdmission, emerging: e.emerging, at: e.transform })), deadlineTicks })}`);
      if (reached.size !== ids.length) console.log(`[qa:invariants] ${name} unreached: ${JSON.stringify(ids.filter((_id, arrival) => !reached.has(arrival)).map(id => {
        const e = w.entities.get(id);
        const brain=e?.infected?.l1, target=brain&&w.entities.get(brain.targetId);
        return { id, at: e?.transform, state: e?.infected?.state, mode:brain?.mode, goal:brain&&[brain.goalX,brain.goalZ], focus:brain&&[brain.focusId,brain.focusUntil,w.tick], completeApproach:brain?.search.completeApproach, scripted:e?.infected?.scripted, target:target&&{id:target.id,at:target.transform}, pending: e?.pendingAdmission, emerging: e?.emerging, nearestGuardM: e && Math.min(...s.soldierIds.map(id => w.entities.get(id)).filter(e => !!e && e.health.current > 0).map(g => Math.hypot(g!.transform.x - e.transform.x, g!.transform.z - e.transform.z))) };
      }))}`);
      if (ids.length !== expected || admitted.size !== expected || reached.size !== expected || !collapse && breachCounts.some(count => count !== expectedPerBreach)) {
        errors.push(`${name}: authored ${expected} (${collapse ? 'collapse batches' : `${expectedPerBreach} per breach`}), spawned ${ids.length}, admitted ${admitted.size}, reached ${reached.size}, breach counts ${breachCounts.join(',')}`);
      }
    } finally { vi.restoreAllMocks(); w.dispose(); }
  }
  expect(errors, 'waves invariant: L4 authored count and goal arrival').toEqual([]);
  if (tier === 'high') await assertL5Population();
}, 480_000);
