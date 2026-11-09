import { expect, test, vi } from 'vitest';
import { loadLevel } from './world';
import { l4, l4Edges, l4Emergence, l4Route, l4RoutePose, l4ConvoyStations } from '../../../src/data/l4';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';
import { Status } from '../../../src/sim/combat/Status';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { InfectedState } from '../../../src/sim/ai/types';
import { runLevel, runnerLevels } from '../../../tools/sim-runner/levels';
import { loadLevel as loadTieredLevel } from './world';
import { l5, l5Wanderers } from '../../../src/data/l5';

type Census = { spawned: number; alphaSpawned: number; alive: number; alphaAlive: number; kills: number; attackStarts: number; hitsOnCourier: number; damageToCourier: number; courierKills: number; meanKillSeconds: number | null };
type AIWithScript = {
  followScript: (e: EntitySnapshot, b: InfectedState) => boolean;
  seek: (e: EntitySnapshot, point: { x: number; z: number }, speed?: number) => void;
  place: (e: EntitySnapshot) => void;
  noticeDuringApproach: (...args: never[]) => void;
};
const campaignLevels = runnerLevels.filter(id => /^L([3-9]|10)$/.test(id));

async function campaignCensus(prodBehavior: boolean) {
  const originalUpdate = SimWorld.prototype.update;
  const worlds = new WeakMap<SimWorld, { seen: Set<number>; kills: number; attacks: number; hitsOnCourier: number; damageToCourier: number; courierKills: number; firstHit: Map<number, number>; ttk: number[]; samples: Map<number, Census>; patched: boolean }>();
  const result = new Map<string, { samples: Map<number, Census>; report?: Pick<Awaited<ReturnType<typeof runLevel>>, 'time' | 'kills' | 'damageTaken' | 'deaths' | 'outcome'> }>();
  (SimWorld.prototype as unknown as { update: () => void }).update = function(this: SimWorld) {
    let state = worlds.get(this);
    if (!state) {
      state = { seen: new Set(), kills: 0, attacks: 0, hitsOnCourier: 0, damageToCourier: 0, courierKills: 0, firstHit: new Map(), ttk: [], samples: new Map(), patched: false };
      worlds.set(this, state); result.set(this.scenario ?? '?', { samples: state.samples });
    }
    if (!state.patched) {
      state.patched = true;
      this.events.on('combat.kill', () => state!.kills++);
      this.events.on('telegraph', event => {
        if (event.type === 'telegraph' && typeof event.sourceId === 'number' && this.entities.get(event.sourceId)?.infected) state!.attacks++;
      });
      this.events.on('combat.hit', event => {
        if (event.type !== 'combat.hit') return;
        const source = this.entities.get(event.sourceId), target = this.entities.get(event.targetId);
        if (source?.infected && target?.id === 1 && event.amount > 0) { state!.hitsOnCourier++; state!.damageToCourier += event.amount; }
        if (event.sourceId === 1 && target?.infected && event.amount > 0 && !state!.firstHit.has(target.id)) state!.firstHit.set(target.id, event.tick);
      });
      this.events.on('combat.kill', event => {
        if (event.type !== 'combat.kill' || event.sourceId !== 1 || !this.entities.get(event.targetId)?.infected) return;
        state!.courierKills++;
        const first = state!.firstHit.get(event.targetId);
        if (first !== undefined) state!.ttk.push((event.tick - first) / 60);
      });
      if (prodBehavior && this.infected) {
        const ai = this.infected as unknown as AIWithScript;
        ai.followScript = (e, b) => {
          // PROD 793be6bd3's exact script gate, before Q-279 and party perception.
          if (!b.scripted || b.specialAttack) return false;
          const retreat = b.clearingStreet || b.l4ArmyApproach && this.missions?.state.l4?.phase === 'collapse';
          const speed = retreat ? b.l1?.runSpeed ?? Math.max(b.speed, b.clearingStreet ? 4.8 : 3.4) : b.breachApproach ? b.l1?.runSpeed : undefined;
          if (!Status.stunned(e, this.tick) && Math.hypot(e.transform.x - b.scripted.x, e.transform.z - b.scripted.z) > .6) ai.seek(e, b.scripted, speed);
          e.combat!.attacking = false; ai.place(e); return true;
        };
        ai.noticeDuringApproach = () => {};
      }
    }
    originalUpdate.call(this);
    for (const e of this.entities.iterate()) if (e.infected) state.seen.add(e.id);
    const seconds = this.tick / 60;
    if ([34, 60, 294].includes(seconds) && !state.samples.has(seconds)) {
      const live = [...this.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && !e.infected.hidden);
      state.samples.set(seconds, {
        spawned: state.seen.size,
        alphaSpawned: [...state.seen].filter(id => this.entities.get(id)?.archetype === 'infected.alpha').length,
        alive: live.length, alphaAlive: live.filter(e => e.archetype === 'infected.alpha').length, kills: state.kills,
        attackStarts: state.attacks, hitsOnCourier: state.hitsOnCourier, damageToCourier: state.damageToCourier,
        courierKills: state.courierKills, meanKillSeconds: state.ttk.length ? state.ttk.reduce((sum, time) => sum + time, 0) / state.ttk.length : null,
      });
    }
  };
  try {
    for (const level of campaignLevels) {
      const report = await runLevel(level, 'complete', 1, level === 'L6' ? 360 : 60), census = result.get(level);
      if (census) census.report = { time: report.time, kills: report.kills, damageTaken: report.damageTaken, deaths: report.deaths, outcome: report.outcome };
    }
    return result;
  } finally { (SimWorld.prototype as unknown as { update: () => void }).update = originalUpdate; }
}

async function assertCampaignSpawnParity() {
  const prod = await campaignCensus(true), current = await campaignCensus(false);
  const receipt: Record<string, Record<number, { prod: Census; current: Census }>> = {};
  for (const level of campaignLevels) {
    const before = prod.get(level), after = current.get(level);
    expect(before, `${level}: PROD census`).toBeDefined(); expect(after, `${level}: current census`).toBeDefined();
    receipt[level] = {};
    for (const second of [34, 60]) {
      const a = before!.samples.get(second), b = after!.samples.get(second);
      expect(a, `${level} ${second}s PROD census`).toBeDefined(); expect(b, `${level} ${second}s current census`).toBeDefined();
      receipt[level][second] = { prod: a!, current: b! };
      expect(Math.abs(b!.spawned - a!.spawned), `${level} ${second}s spawned`).toBeLessThanOrEqual(a!.spawned * .1);
      expect(Math.abs(b!.alphaSpawned - a!.alphaSpawned), `${level} ${second}s Alpha spawns`).toBeLessThanOrEqual(a!.alphaSpawned * .1);
      if (a!.alphaSpawned > 0) expect(b!.alphaSpawned, `${level} ${second}s Alpha presence`).toBeGreaterThan(0);
    }
    if (level === 'L6') {
      console.log(`[qa:invariants] L6 PROD/current full run: ${JSON.stringify({ prod: before!.report, current: after!.report, at60: { prod: before!.samples.get(60), current: after!.samples.get(60) } })}`);
    }
  }
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
        expect(Math.hypot(point.x - ring.x, point.z - ring.z), `${tier} survivor exclusion`).toBeGreaterThanOrEqual(8);
      }
      for (let i = 0; i < spread.length; i++) for (let j = i + 1; j < spread.length; j++) {
        expect(Math.hypot(spread[i].x - spread[j].x, spread[i].z - spread[j].z), `${tier} scattered infected spacing`).toBeGreaterThanOrEqual(4);
      }
    } finally { world.dispose(); }
  }
  console.log(`[qa:invariants] L3–L10 PROD/current spawn census: ${JSON.stringify(receipt)}`);
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
      // The Alpha spawn quota is measured separately; release its slots so this finite-wave census can complete without combat deaths.
      w.infected!.director.reserved = 0;
      const base = collapse ? l4.war.collapseWaveSize : l4.war.waveSize[wave];
      const n = Math.max(1, Math.ceil(base * (tier === 'low' ? .5 : 1) * (collapse ? 1 : l4.war.waveScale)));
      const ring = l4Edges.length - 1, expected = collapse ? n * l4.war.edgesPerWave : Math.ceil(n * l4.war.edgesPerWave / ring) * ring;
      // Authored group cadence plus the longest emergence approach at walking pace, with a 15 s admission margin.
      const approach = Math.max(...l4Emergence.map(e => Math.hypot(e.at[0] - l4.map.centre.x, e.at[1] - l4.map.centre.z)));
      const deadlineTicks = Math.ceil((Math.ceil(expected / ring / l4.war.group[0]) * l4.war.groupEveryS[1] + approach / 1.6 + 15) * 60);
      c.waves(); s.waveAt = s.collapseWaveAt = Infinity;
      const ids = new Set<number>(), admitted = new Set<number>(), reached = new Set<number>();
      const collect = () => {
        for (const id of collapse ? s.collapseIds : s.emergedIds) if (collapse || s.origin[id] < l4Emergence.length) ids.add(id);
      };
      collect();
      const applyDamage = w.combat!.damage.apply.bind(w.combat!.damage);
      // An immortal body can be stagger-locked by gunfire forever before crossing the line. Suppress the hit
      // transaction for the measured identities, including its stagger/knockback, rather than only raising HP.
      vi.spyOn(w.combat!.damage, 'apply').mockImplementation(hit => ids.has(hit.targetId) ? 0 : applyDamage(hit));
      for (let tick = 0; tick < deadlineTicks && (ids.size < expected || reached.size < expected); tick++) {
        // Keep the authored target roster alive; this measures arrival routes rather than combat outcomes.
        for (const e of w.entities.iterate()) if (e.civilian && !e.infected) { e.health.current = e.health.max = 1_000_000; delete e.infection; }
        for (const id of ids) { const e = w.entities.get(id); if (e) e.health.current = e.health.max = 1_000_000; }
        followFrustum(w); w.update(); collect();
        for (const id of ids) {
          const e = w.entities.get(id); if (!e || e.hidden || e.pendingAdmission || e.infected?.hidden) continue;
          admitted.add(id);
          const p = l4.perimeter, at = e.transform;
          if (at.x > p.x0 - 1.5 && at.x < p.x1 + 1.5 && at.z > p.z0 - 1.5 && at.z < p.z1 + 1.5) {
            reached.add(id); w.infected!.release(e); // Free the real cap for the remainder of this wave.
          }
        }
      }
      const name = `L4/${tier}/${collapse ? 'collapse' : `war-${wave}`}`;
      const byBreach = new Array(ring).fill(0);
      if (!collapse) for (const id of ids) {
        const source = l4Emergence[s.origin[id]];
        if (source) byBreach[source.edge]++;
      }
      const expectedPerBreach = Math.ceil(n * l4.war.edgesPerWave / ring);
      const breachCounts = byBreach.slice(0, ring);
      console.log(`[qa:invariants] ${name}: authored=${expected} spawned=${ids.size} admitted=${admitted.size} reached=${reached.size}${collapse ? '' : ` per-breach=${breachCounts.join(',')}`}`);
      if (ids.size !== expected) console.log(`[qa:invariants] ${name} queued: ${JSON.stringify({ pend: s.pend, perimeterPending: s.perimeterPending, active: w.infected!.active.filter(e => e.health.current > 0).map(e => ({ id: e.id, origin: s.origin[e.id], pending: e.pendingAdmission, emerging: e.emerging, at: e.transform })), deadlineTicks })}`);
      if (reached.size !== ids.size) console.log(`[qa:invariants] ${name} unreached: ${JSON.stringify([...ids].filter(id => !reached.has(id)).map(id => {
        const e = w.entities.get(id);
        const brain=e?.infected?.l1, target=brain&&w.entities.get(brain.targetId);
        return { id, at: e?.transform, state: e?.infected?.state, mode:brain?.mode, goal:brain&&[brain.goalX,brain.goalZ], focus:brain&&[brain.focusId,brain.focusUntil,w.tick], completeApproach:brain?.search.completeApproach, scripted:e?.infected?.scripted, target:target&&{id:target.id,at:target.transform}, pending: e?.pendingAdmission, emerging: e?.emerging, nearestGuardM: e && Math.min(...s.soldierIds.map(id => w.entities.get(id)).filter(e => !!e && e.health.current > 0).map(g => Math.hypot(g!.transform.x - e.transform.x, g!.transform.z - e.transform.z))) };
      }))}`);
      if (ids.size !== expected || admitted.size !== expected || reached.size !== expected || !collapse && breachCounts.some(count => count !== expectedPerBreach)) {
        errors.push(`${name}: authored ${expected} (${collapse ? 'collapse batches' : `${expectedPerBreach} per breach`}), spawned ${ids.size}, admitted ${admitted.size}, reached ${reached.size}, breach counts ${breachCounts.join(',')}`);
      }
    } finally { vi.restoreAllMocks(); w.dispose(); }
  }
  expect(errors, 'waves invariant: L4 authored count and goal arrival').toEqual([]);
  if (tier === 'high') await assertCampaignSpawnParity();
}, 480_000);
