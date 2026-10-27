import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/**
 * l4-collapse (PO 2026-10-12: "the soldiers cannot hold the lines, but they do easily, so there is no outbreak and no chaos"; design
 * approved "ok let's try that!"): the outbreak starts behind the lines and the army loses three lines on fixed beats, also when the courier
 * shoots optimally. One seed per case (PO 10-09: no batteries).
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;
const output = process.env.L4_COLLAPSE_OUTPUT ?? 'test-results/epics/E22';
const inRing = (p: { x: number; z: number }) => { const r = l4.map.ring; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; };

interface Trace {
  beats: { beat: string; t: number; cause: string; soldiers: number; inside: number }[]; soldiers: { t: number; n: number }[]; fallBackRadio: number; breakT: number; cause: string; knockdowns: number; barricades: number; turnedAtTurn: number; tank: string; maxAlive: number; maxInside: number;
  /** l4-collapse-2: line-1 size at the turn; infected on the escape street east of the ring (> 12 m from the courier) at "Fall back!" and 4 s later; the most drawn bodies in one 4 m square; attackers around the still courier (samples with >= 4 within 2.5 m: occupied 90-degree quadrants). */
  line1Size: number; line1Fallback: number; firstBreach: number; gapAtFallBack: number; gapAfter: number; heapMax: number; corpseLosses: number; ringSamples: number[]; pressMax: number;
}
const escapeDistance = (p: { x: number; z: number }) => { const r = l4.director.escape.route; let best = Infinity; for (let i = 1; i < r.length; i++) { const [ax, az] = r[i - 1], [bx, bz] = r[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(p.x - ax - dx * t, p.z - az - dz * t)); } return best; };
/** Runs the war with the courier idle at the quartermaster (god); `shoot` downs the nearest live infected in 26 m every 6 ticks (an oracle machine gunner). */
function war(w: SimWorld, m: Mission, seed: number, tier: 'high' | 'low', shoot: boolean, retreatSettleS = 0): Trace {
  const corpseIds = new Set<number>(), retreatAudit: object[] = [];
  const s = m.state.l4!, tr: Trace = { beats: [], soldiers: [], fallBackRadio: -1, breakT: -1, cause: '', knockdowns: 0, barricades: 0, turnedAtTurn: 0, tank: '', maxAlive: 0, maxInside: 0, line1Size: 0, line1Fallback: 0, firstBreach: -1, gapAtFallBack: -1, gapAfter: -1, heapMax: 0, corpseLosses: 0, ringSamples: [], pressMax: 0 };
  // Recovery poses cannot move or attack. Count the active street horde,
  // retaining large Alphas even while their reaction plays.
  const onStreet = () => { const p = w.entities.get(1)!.transform; return w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && (e.archetype === 'infected.alpha' || !e.combat?.reaction?.heavy || e.combat.reaction.until <= w.tick) && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > 12 && e.transform.x > -8 && escapeDistance(e.transform) < l4.director.escape.gapM).length; }; // the street out of the ring (its plaza end holds the pursuers)
  const t = (tick: number) => +((tick - s.turnAt) / 60).toFixed(2);
  w.events.on('l4.beat', e => { if (e.type === 'l4.beat') tr.beats.push({ beat: e.beat, t: t(e.tick), cause: e.cause, soldiers: e.soldiers, inside: e.inside }); });
  w.events.on('barricade.broken', e => { if (e.type === 'barricade.broken' && e.groupId === 'l4-wall' && tr.firstBreach < 0) tr.firstBreach = t(e.tick); });
  w.events.on('l4.firstTurn', e => { if (e.type === 'l4.firstTurn') tr.turnedAtTurn = e.ids.length; });
  w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line' && e.id === 'L4.fallback') tr.fallBackRadio = t(e.tick); });
  runL4(w, m, 'idle', { seed, god: true, maxSeconds: 480, stopWhen: mm => {
    const st = mm.state.l4!;
    if (retreatSettleS && st.lineBreakAt && (w.tick - st.lineBreakAt) % 1800 === 0) {
      retreatAudit.push({ seconds: (w.tick - st.lineBreakAt) / 60, pockets: st.pockets, pocketSpawned: { ...st.pocketSpawned }, reserved: w.infected!.director.reserved,
        soldiers: st.soldierIds.map(id => w.entities.get(id)!).filter(e => e?.civilian && !e.infection && e.health.current > 0).map(e => ({ id: e.id, at: { ...e.transform }, hp: e.health.current, ally: e.civilian!.ally })),
        infected: w.infected!.active.filter(e => e.health.current > 0).map(e => { const b = e.infected!.l1; return { id: e.id, archetype: e.archetype, at: { ...e.transform }, hp: e.health.current, state: e.infected!.state, emerging: e.emerging, scripted: e.infected!.scripted, focus: b?.focusId, target: b?.targetId, mode: b?.mode, goal: b && [b.goalX, b.goalZ], search: b?.search, nativeTarget: e.infected!.heardTargetId }; }),
      });
    }
    for (const id of corpseIds) if (!w.entities.get(id)?.corpse) { tr.corpseLosses++; corpseIds.delete(id); }
    for (const e of w.entities.iterate()) if (e.corpse && e.faction === 'infected') corpseIds.add(e.id);
    if (st.turnAt && (w.tick - st.turnAt) % 60 === 0) tr.soldiers.push({ t: t(w.tick), n: st.soldierIds.filter(id => { const e = w.entities.get(id); return e?.civilian && !e.infection && e.health.current > 0; }).length });
    if (st.phase === 'war') tr.maxInside = Math.max(tr.maxInside, w.infected!.active.filter(e => e.health.current > 0 && inRing(e.transform)).length);
    tr.maxAlive = Math.max(tr.maxAlive, w.infected!.active.filter(e => e.health.current > 0).length);
    if (st.turnAt && !tr.line1Size) tr.line1Size = st.director.lines[0].size;
    const firstLine = st.director.lines[0];
    if (firstLine.brokeAt && w.tick >= firstLine.brokeAt + 10 * 60 && !tr.line1Fallback) {
      const posts = l4.director.fallback1.map(([x, z]) => ({ x, z }));
      tr.line1Fallback = firstLine.soldierIds.filter(id => {
        const e = w.entities.get(id);
        return e?.health.current && posts.some(p => Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 2.5);
      }).length;
    }
    if (st.lineBreakAt && w.tick === st.lineBreakAt) tr.gapAtFallBack = onStreet();
    if (st.lineBreakAt && w.tick === st.lineBreakAt + 240) tr.gapAfter = onStreet();
    if (st.turnAt && w.tick % 60 === 0) {
      const cells = new Map<number, number>(), c = l4.war.heap.cellM;
      for (const e of w.entities.iterate()) if (e.corpse && e.faction === 'infected' && !e.hidden) { const k = Math.floor(e.transform.x / c) * 4096 + Math.floor(e.transform.z / c); cells.set(k, (cells.get(k) ?? 0) + 1); }
      tr.heapMax = Math.max(tr.heapMax, ...cells.values(), 0);
      const p = w.entities.get(1)!.transform, close = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.5);
      tr.pressMax = Math.max(tr.pressMax, w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 1.9).length);
      if (st.phase === 'war' && close.length >= 4) tr.ringSamples.push(new Set(close.map(e => Math.floor((Math.atan2(e.transform.z - p.z, e.transform.x - p.x) + Math.PI) / (Math.PI / 2)) % 4)).size);
    }
    if (shoot && st.phase === 'war' && w.tick % 6 === 0) {
      const p = w.entities.get(1)!.transform;
      const target = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= l4.machineGun.rangeM && w.combat!.query.visible(p, e.transform))
        .sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
      if (target) { const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1; w.combat!.damage.apply({ attackId: 0, actionId: l4.machineGun.id, sourceId: 1, targetId: target.id, origin: { x: p.x, z: p.z }, direction: { x: dx / d, z: dz / d }, base: 999, multiplier: 1, type: 'bullet', knockback: 0, stagger: .3 }); }
    }
    return st.lineBreakAt > 0 && w.tick - st.lineBreakAt > Math.max(250, (retreatSettleS + 1) * 60);
  } });
  tr.breakT = s.lineBreakAt ? t(s.lineBreakAt) : -1; tr.cause = s.lineCause; tr.knockdowns = s.director.knockdowns; tr.barricades = s.director.barricades; tr.tank = s.tankPhase;
  mkdirSync(output, { recursive: true });
  if (retreatAudit.length) writeFileSync(`${output}/collapse-${tier}-audit.json`, JSON.stringify(retreatAudit, null, 1) + '\n');
  writeFileSync(`${output}/collapse-${tier}-${shoot ? 'shooter' : 'idle'}.json`, JSON.stringify(tr, null, 1) + '\n');
  return tr;
}
function beatsOnTime(tr: Trace): void {
  expect(tr.corpseLosses, 'corpses persist through the whole war').toBe(0);
  expect(tr.beats.map(b => b.beat)).toEqual(['line-1', 'nests', 'armor']);
  for (const [i, b] of tr.beats.entries()) {
    if (i === 0) { expect(b.t, 'line 1 falls as soon as the first wall breach opens').toBeCloseTo(tr.firstBreach, 0); continue; }
    const def = l4.director.lines[i];
    expect(b.t, b.beat).toBeGreaterThanOrEqual(def.earliestS - .2); expect(b.t, b.beat).toBeLessThanOrEqual(def.dueS + .5);
  }
  // "Fall back!" on the radio, then the line is gone (the hide objective and the fuel-truck chain follow from lineBreak).
  expect(tr.cause).toBe('beats');
  expect(tr.breakT).toBeCloseTo(tr.beats[2].t + l4.lineBreak.fallBackS, 0); expect(tr.fallBackRadio).toBeCloseTo(tr.breakT, 1);
  expect(tr.tank).toBe('silent');
  // Losses are real (bites and turns, never scripted removal) and only go one way.
  for (let i = 1; i < tr.soldiers.length; i++) expect(tr.soldiers[i].n).toBeLessThanOrEqual(tr.soldiers[i - 1].n);
}

describe('L4 collapse director', () => {
  test('T-E22-Q166 @E22 @E22-AC14 seed 3 low: the 150-second corpse field stays within the rebalanced 150-body limit', async () => {
    const l = await loadL4(3, 'low'); world = l.world;
    let within14 = -1;
    runL4(l.world, l.mission, 'idle', { seed: 3, god: true, maxSeconds: 240, stopWhen: m => {
      const s = m.state.l4!;
      if (!s.turnAt || l.world.tick < s.turnAt + 150 * 60) return false;
      const p = l.world.entities.get(1)!.transform;
      within14 = [...l.world.entities.iterate()].filter(e => e.faction === 'infected' && e.health.current <= 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 14).length;
      return true;
    } });
    expect(within14, 'dead infected within 14 m of the held courier at 150 s').toBeGreaterThanOrEqual(0);
    expect(within14).toBeLessThanOrEqual(150);
  }, HEAVY);

  test('T-E22-13-collapse @E22 @E22-AC13 idle courier: breach flood reaches line 1, soldiers physically fall back, then the three lines fall on their beats', async () => {
    const l = await loadL4(2); world = l.world;
    // The breach now sends the first line physically past the courier. Losses
    // resolve while the horde pursues the later retreat, rather than on the
    // old armor deadline. Give that retreat ninety seconds to resolve.
    const retreatSettleS = 90;
    const tr = war(l.world, l.mission, 2, 'high', false, retreatSettleS);
    expect(tr.turnedAtTurn).toBeGreaterThanOrEqual(15); expect(tr.turnedAtTurn).toBeLessThanOrEqual(25);
    beatsOnTime(tr);
    // Count the whole army, including soldiers outside the three line groups.
    // A bound on the nine-person first line alone would be vacuous.
    const atTurn = tr.soldiers[0].n, atBreach = tr.soldiers.find(x => x.t >= tr.firstBreach);
    const afterRetreat = tr.soldiers.find(x => x.t >= tr.breakT + retreatSettleS);
    expect(atBreach).toBeDefined(); expect(afterRetreat).toBeDefined();
    expect(afterRetreat!.n).toBeLessThan(10); expect(afterRetreat!.n).toBeLessThan(atTurn * .5);
    expect(atBreach!.n).toBeLessThanOrEqual(atTurn);
    expect(tr.barricades).toBeGreaterThanOrEqual(1); expect(tr.knockdowns).toBeGreaterThanOrEqual(1);
    expect(tr.maxInside, 'a flood enters during the hold, including between the three instantaneous fall beats').toBeGreaterThanOrEqual(5);
    expect(tr.line1Fallback, 'surviving first-line soldiers reach the deeper second line after the breach').toBeGreaterThanOrEqual(4);
    expect(tr.maxAlive).toBeLessThanOrEqual(l4.war.caps.infected.high);
    void inRing;
  }, HEAVY);

  test('T-E22-13-escape @E22 @E22-AC13 @E22-AC15 l4-collapse-2: at "Fall back!" the horde leaves a gap on the escape street; corpses persist throughout the war and no stack surrounds a still courier', async () => {
    const l = await loadL4(2); world = l.world;
    const tr = war(l.world, l.mission, 2, 'high', false);
    // The gap: infected on the escape street (beyond the pursuers) run off toward the army and nothing emerges on it.
    expect(tr.gapAfter).toBeGreaterThanOrEqual(0); expect(tr.gapAfter).toBeLessThanOrEqual(Math.max(3, tr.gapAtFallBack / 3));
    // PO 10-14: bodies remain for the whole level, including dense visible piles.
    expect(tr.corpseLosses).toBe(0);
    // Attackers around the still courier take ring slots: most crowded samples occupy at least three quadrants.
    if (tr.ringSamples.length) expect(tr.ringSamples.reduce((a, b) => a + b, 0) / tr.ringSamples.length).toBeGreaterThanOrEqual(2.5);
    // The rest wait on the outer rings: no mound of bodies pressing on her (the 1.4 m ring holds about eight).
    expect(tr.pressMax).toBeLessThanOrEqual(16);
  }, HEAVY);

  test('T-E22-13-collapse-shooter @E22 @E22-AC13 an optimal machine gunner (one down every 0.1 s in 26 m) cannot save the lines: the beats keep their windows', async () => {
    const l = await loadL4(3); world = l.world;
    const tr = war(l.world, l.mission, 3, 'high', true);
    beatsOnTime(tr);
  }, HEAVY);

  test('T-E22-13-collapse-low @E22 @E22-AC13 the low tier keeps the beats inside its caps', async () => {
    const l = await loadL4(2, 'low'); world = l.world;
    const tr = war(l.world, l.mission, 2, 'low', false);
    beatsOnTime(tr);
    expect(tr.maxAlive).toBeLessThanOrEqual(l4.war.caps.infected.low);
  }, HEAVY);
});
