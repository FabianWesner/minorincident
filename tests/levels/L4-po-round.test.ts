import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l4, l4Emergence, l4Inside, l4Line, l4Posts } from '../../src/data/l4';
import { l4AlphaEmergence } from '../../src/levels/L4/layout';
import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/**
 * l4-po-round (PO 10-13, verbatim):
 * 1. "L4: Let the user exit the 1st bus which is ON the military area. RIght now the user leacves on the street outsd of it and might walk away"
 * 2. "L4: before the alarm let solidiers be relaxed. The take their position when the alarm is running. Peds are wlaking around before the alarm and when the alarm is on, they panik and try to hide"
 * 3. "L4: Zombies still have no chance against soldiers. Let them come from all directios, not in bulk. ALso from within buildings inside the army area. And add more alphas. The current one has zero chance."
 * Single seeds, the courier idle (PO 10-09: no batteries).
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;
type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const inRing = (p: P) => { const r = l4.map.ring; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; };
const human = (e: EntitySnapshot | undefined): e is EntitySnapshot => !!e && !!e.civilian && !e.infection && e.health.current > 0 && e.civilian.state !== 'finished';
const record = (name: string, value: unknown) => { mkdirSync('test-results/epics/E22', { recursive: true }); writeFileSync(`test-results/epics/E22/${name}.json`, JSON.stringify(value, null, 1) + '\n'); };
/** 45-degree sector of a point around the plaza centre. */
const sector = (p: P) => Math.floor((Math.atan2(p.z - l4.map.centre.z, p.x - l4.map.centre.x) + Math.PI) / (Math.PI / 4)) % 8;

describe('L4 PO round 10-13', () => {
  test('T-E22-po-1 @E22 @E22-AC04 the courier gets off the first bus inside the military area and cannot walk out before the line breaks', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    const lines: string[] = []; w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') lines.push(e.id); });
    while (s.phase === 'convoy') w.update();
    const bus = w.entities.get(s.convoyIds[l4.convoy.vehicles.findIndex(v => v.player)])!.transform, p0 = { ...w.entities.get(1)!.transform };
    expect(l4.convoy.vehicles.findIndex(v => v.player)).toBe(l4.convoy.vehicles.findIndex(v => v.asset === 'veh.evac-bus'));
    expect(inRing(p0), `exit ${p0.x.toFixed(1)},${p0.z.toFixed(1)}`).toBe(true); expect(dist(p0, bus)).toBeLessThan(l4.convoy.vehicles.find(v => v.player)!.len / 2 + 1.5);
    expect(dist(p0, { x: -23.2, z: .6 })).toBeLessThan(14);
    const corgi = [...w.entities.iterate()].find(e => e.companion); if (corgi) expect(inRing(corgi.transform)).toBe(true);
    // PO 10-15: the visible perimeter holds during the alarm/hold phase.
    m.completeObjective('quartermaster');
    while (!s.turnAt) w.update();
    w.combat!.damage.god = true;
    // Barriers in the gap, and walking out in any direction stops at the perimeter.
    expect(s.gateIds.length).toBeGreaterThanOrEqual(1);
    const walk = (x: number, z: number, n: number) => { for (let i = 0; i < n; i++) { w.applyInput({ ...emptyInput(), move: { x, z } }, 'keyboard'); w.update(); } return { ...w.entities.get(1)!.transform }; };
    const pe = l4.perimeter, out: Record<string, P> = {};
    // Start a boundary attempt on the clear south apron: the parked column
    // can stop an eastward walk from the bus before it reaches the perimeter.
    const player = w.entities.get(1)!;
    Object.assign(player.transform, { x: -11.21, z: 21.1 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    Object.assign(w.previousPlayer!, player.transform); w.spatial.set(1, player.transform.x, player.transform.z); w.clearInput();
    out.south = walk(0, 1, 60); expect(out.south.z).toBeLessThanOrEqual(pe.z1 + .1);
    out.east = walk(1, 0, 8 * 60); expect(out.east.x).toBeLessThanOrEqual(pe.x1 + .1);
    out.southEast = walk(.7, .7, 10 * 60); expect(out.southEast.x).toBeLessThanOrEqual(pe.x1 + .1); expect(out.southEast.z).toBeLessThanOrEqual(pe.z1 + .1);
    out.west = walk(-1, 0, 14 * 60); expect(out.west.x).toBeGreaterThanOrEqual(pe.x0 - .1);
    out.north = walk(0, -1, 14 * 60); expect(out.north.z).toBeGreaterThanOrEqual(pe.z0 - .1);
    expect(lines).toContain('L4.perimeter');
    // After the gun and the turn the war keeps her in; at "Fall back!" (the line break) the gate opens onto the escape street.
    m.completeObjective('hold');
    expect(s.phase).toBe('collapse');
    // Use the authored passage below the parked trucks; the old z=5.6
    // straight-line fixture walked through a truck rather than through the gate.
    const [gx, gz] = l4.director.escape.route[0], gate = { x: gx, z: gz }; Object.assign(w.entities.get(1)!.transform, gate); w.physics.playerBody!.setTranslation({ x: gate.x, y: w.entities.get(1)!.transform.y, z: gate.z }, true); w.spatial.set(1, gate.x, gate.z);
    w.combat!.damage.god = true;
    out.escape = walk(1, 0, 4 * 60); expect(out.escape.x).toBeGreaterThan(pe.x1 + 2);
    record('po-round-perimeter', { exit: p0, bus, out });
  }, HEAVY);

  test('T-E22-po-2 @E22 @E22-AC05 @E22-AC07 soldiers relaxed before the alarm and at their posts within 10 s of it; people in routines, then fleeing and hiding', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    w.combat!.damage.god = true;
    while (s.phase === 'convoy') w.update();
    step(w, 3 * 60); m.completeObjective('quartermaster');
    const post = (id: number) => w.entities.get(id)!.civilian!.ally!.post!;
    let aimedBefore = 0, offPostMax = 0, routineMin = 1, samples = 0;
    while (s.phase === 'plaza') {
      step(w, 30); if (s.phase !== 'plaza') break; samples++;
      const soldiers = s.soldierIds.map(id => w.entities.get(id)).filter(human);
      aimedBefore = Math.max(aimedBefore, soldiers.filter(e => e.civilian!.story?.clip === 'shoot' || !!e.civilian!.ally!.targetId || e.civilian!.ally!.engaged).length);
      offPostMax = Math.max(offPostMax, soldiers.filter(e => dist(e.transform, post(e.id)) > 2).length);
      const peds = [...w.entities.iterate()].filter(e => human(e) && !e.hidden && !e.civilian!.ally && !e.civilian!.pet && !s.soldierIds.includes(e.id));
      routineMin = Math.min(routineMin, peds.filter(e => e.civilian!.state === 'calm' && !!e.civilian!.schedule?.length).length / Math.max(1, peds.length));
    }
    expect(s.phase).toBe('war'); expect(samples).toBeGreaterThan(40);
    // The alarm: soldiers at (or running to) their posts, people panicking (fleeing to a door or a street edge, hiding, gone inside).
    const turn = s.turnAt, soldiers = s.soldierIds.filter(id => human(w.entities.get(id)));
    const armed = new Set(s.armed.map(a => a.id)), turners = new Set(s.turnerIds);
    const peds = [...w.entities.iterate()].filter(e => human(e) && !e.hidden && !e.civilian!.ally && !e.civilian!.pet && !s.soldierIds.includes(e.id) && !armed.has(e.id) && !turners.has(e.id)).map(e => e.id);
    const start = new Map(soldiers.map(id => [id, dist(w.entities.get(id)!.transform, post(id))]));
    step(w, 10 * 60 - (w.tick - turn));
    const live = soldiers.filter(id => human(w.entities.get(id)));
    const onDuty = live.filter(id => { const e = w.entities.get(id)!, d = dist(e.transform, post(id)); return e.civilian!.ally!.engaged && (d <= 1.5 || !!e.civilian!.ally!.run || d < start.get(id)! - 1); });
    const fled = peds.filter(id => { const e = w.entities.get(id); return !e || e.hidden || !e.civilian || ['flee', 'hide', 'alarmed', 'grabbed', 'bitten', 'down', 'infected'].includes(e.civilian.state) || !!e.infection || e.civilian.story?.clip === 'npc-cower'; });
    const r = { samples, aimedBefore, offPostMax, routineMin, soldiers: soldiers.length, live: live.length, onDuty: onDuty.length, peds: peds.length, fled: fled.length };
    record('po-round-alarm', r);
    expect(aimedBefore, 'no soldier aims or is engaged before the alarm').toBe(0);
    expect(offPostMax, 'soldiers off duty: chatting, coffee, patrols').toBeGreaterThanOrEqual(Math.ceil(soldiers.length * .4));
    expect(routineMin, 'people in their routines before the alarm').toBeGreaterThanOrEqual(.9);
    expect(onDuty.length / live.length, '>= 80 % of soldiers at or heading to their posts 10 s after the alarm').toBeGreaterThanOrEqual(.8);
    expect(fled.length / peds.length, '>= 70 % of the unarmed people flee or hide within 10 s').toBeGreaterThanOrEqual(.7);
  }, HEAVY);

  for (const tier of ['high', 'low'] as const) test(`T-E22-civilians-stay-${tier} @E22 @E22-AC07 pre-alarm camp civilians remain human and panic/hide; incoming infected are new entities`, async () => {
    const l = await loadL4(2, tier); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    w.combat!.damage.god = true;
    while (s.phase === 'convoy') w.update();
    step(w, 3 * 60); m.completeObjective('quartermaster');
    while (w.tick + 1 < s.turnDueAt) w.update();
    const cohort = [...s.evacueeIds, ...s.residentIds].filter(id => {
      const e = w.entities.get(id); return human(e) && !e.hidden && !e.civilian!.pet && inRing(e.transform);
    });
    const before = new Set([...w.entities.iterate()].map(e => e.id));
    const infections: number[] = [];
    w.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && cohort.includes(e.entityId) && e.phase === 'stagger') infections.push(w.entities.get(e.entityId)!.infection!.biteSourceId); });
    expect(cohort.length).toBeGreaterThanOrEqual(tier === 'high' ? 20 : 10);
    w.update();
    expect(s.turnAt).toBe(w.tick);
    step(w, 5 * 60);
    const humans = cohort.filter(id => human(w.entities.get(id)));
    const panicking = humans.filter(id => ['flee', 'hide', 'alarmed'].includes(w.entities.get(id)!.civilian!.state) || w.entities.get(id)!.civilian!.story?.clip === 'npc-cower');
    const newInfected = s.emergedIds.filter(id => !before.has(id));
    record(`civilians-stay-${tier}`, { cohort: cohort.length, humans: humans.length, panicking: panicking.length, newInfected: newInfected.length, infections });
    expect(humans.length / cohort.length).toBeGreaterThanOrEqual(.9);
    expect(panicking.length / cohort.length).toBeGreaterThanOrEqual(.9);
    expect(newInfected.length).toBeGreaterThanOrEqual(tier === 'high' ? 15 : 8);
    expect(s.emergedIds.every(id => !before.has(id))).toBe(true);
    expect(infections.every(id => id > 0)).toBe(true);
    // Throughout the later collapse pressure, infection must still have a real attacker.
    runL4(w, m, 'idle', { seed: 2, god: true, maxSeconds: 480, stopWhen: mm => mm.state.l4!.lineBreakAt > 0 });
    expect(infections.every(id => id > 0)).toBe(true);
    expect(s.director.turnedInside).toBe(0);
    expect(s.lineCause).toBe('beats');
  }, HEAVY);

  test('T-E22-po-3 @E22 @E22-AC10 @E22-AC12 infected come spread from all sides (and from inside the camp); six to eight Alphas reach the lines and nests; the beats hold', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    const points = [...l4Emergence.map(e => ({ x: e.at[0], z: e.at[1] })), ...l4Inside.map(p => ({ x: p[0], z: p[1] }))];
    const reached = new Set<number>(), reachSectors = new Set<number>(), alphaReached = new Set<number>(), beats: string[] = [];
    const nests = l4Posts.filter(p => p.role === 'hmg').map(p => ({ x: p.at[0], z: p.at[1] })), pallets = l4Line.map(p => ({ x: p.x, z: p.z }));
    const soldierIds = () => s.soldierIds.filter(id => human(w.entities.get(id)));
    w.events.on('l4.beat', e => { if (e.type === 'l4.beat') beats.push(`${e.beat}@${((e.tick - s.turnAt) / 60).toFixed(1)}`); });
    w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && s.alphaIds.includes(e.sourceId) && w.entities.get(e.targetId)?.civilian?.ally?.role === 'soldier') alphaReached.add(e.sourceId); });
    w.events.on('barricade.damaged', e => { if (e.type === 'barricade.damaged' && s.alphaIds.includes(e.sourceId)) alphaReached.add(e.sourceId); });
    let seen = 0, maxGroup = 0; const threats = new Set<number>();
    const r = runL4(w, m, 'idle', { seed: 2, god: true, maxSeconds: 480, stopWhen: mm => {
      const st = mm.state.l4!;
      // Not in bulk: what one emergence point releases at once (one tick) is a small group.
      if (st.emergedIds.length > seen) { const n = new Map<number, number>(); for (const id of st.emergedIds.slice(seen)) n.set(st.origin[id] ?? -1, (n.get(st.origin[id] ?? -1) ?? 0) + 1); maxGroup = Math.max(maxGroup, ...n.values()); seen = st.emergedIds.length; }
      if (st.phase !== 'war' || w.tick % 6) return st.lineBreakAt > 0;
      const soldiers = soldierIds().map(id => w.entities.get(id)!);
      for (const e of w.infected!.active) {
        if (e.health.current <= 0 || e.hidden) continue;
        threats.add(e.id);
        const near = soldiers.some(x => dist(x.transform, e.transform) < 2.2);
        if (near && st.origin[e.id] !== undefined && !reached.has(e.id)) { reached.add(e.id); reachSectors.add(sector(points[st.origin[e.id]])); }
        if (e.archetype === 'infected.alpha' && (near || nests.some(n => dist(n, e.transform) < 3) || pallets.some(p => dist(p, e.transform) < 2))) alphaReached.add(e.id);
      }
      return false;
    } });
    const byTick = new Map<string, number>();
    for (const id of s.emergedIds) { const e = s.origin[id]; if (e === undefined) continue; const k = `${e}`; byTick.set(k, (byTick.get(k) ?? 0) + 1); }
    const total = [...byTick.values()].reduce((a, b) => a + b, 0), share = Math.max(...byTick.values()) / total;
    const inside = s.emergedIds.filter(id => (s.origin[id] ?? -1) >= l4Emergence.length).length;
    const quadrants = new Set([...reachSectors].map(k => Math.floor(k / 2)));
    const out = { total, share, maxGroup, perPoint: Object.fromEntries([...byTick.entries()].map(([k, v]) => [k, v])), inside, reachSectors: [...reachSectors], quadrants: quadrants.size, reached: reached.size, threats: threats.size,
      alphas: s.alphaIds.length, alphaReached: alphaReached.size, alphaAnchors: s.alphaAnchors, beats, breakAfterS: r.breakAfterS, cause: s.lineCause, knockdowns: s.director.knockdowns, barricades: s.director.barricades };
    record('po-round-war', out);
    // PO 10-14: downed infected keep their slots (they get up) under the 120 cap, so the war counts distinct threats
    // (initial turns + new arrivals + Alphas), not only new arrivals.
    expect(threats.size, '> 100 distinct infected fight in the war').toBeGreaterThan(100);
    expect(share, 'no emergence point delivers more than 25 %').toBeLessThanOrEqual(.25);
    expect(maxGroup, 'groups of 2-5, not a stream').toBeLessThanOrEqual(l4.war.group[1]);
    expect(new Set(Object.keys(out.perPoint)).size).toBeGreaterThanOrEqual(12);
    expect(inside, 'infected also come from inside the camp').toBeGreaterThanOrEqual(1);
    expect(reachSectors.size, 'infected reach soldiers from >= 4 directions').toBeGreaterThanOrEqual(4);
    expect(s.alphaIds.length).toBe(l4.alphas.count.high); expect(l4AlphaEmergence.length).toBe(l4.alphas.count.high);
    expect(alphaReached.size, '>= 3 Alphas reach a line or a nest').toBeGreaterThanOrEqual(3);
    // The collapse beats and the escape gap still work.
    expect(beats.map(b => b.split('@')[0])).toEqual(['line-1', 'nests', 'armor']); expect(s.lineCause).toBe('beats');
  }, HEAVY);
});
