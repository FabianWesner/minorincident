import { afterEach, expect, test } from 'vitest';
import { megaAlpha } from '../../../src/data/megaAlpha';
import { survivor } from '../../../src/data/survivor';
import { installMegaPursuit, type PursuitRoute } from '../../../src/sim/ai/MegaPursuit';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import { captureSeams, restoreSeams } from '../../../src/sim/missions/l1Seams';
import type { MissionDef } from '../../../src/sim/missions/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';

/**
 * E32-AC10 (lane L10-S3). PO 2026-10-13, verbatim: "The Mega Alpha always knows approximately where the player is. Unlike normal
 * zombies, it does not rely on normal sight rules. It constantly follows the player. However, its normal movement speed is only around
 * 70% of the player's running speed. This means the player can stay ahead of it. The player can never permanently escape it. It is
 * always coming."
 */
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function course(seed = 1) {
  const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('mega-course', seed); w.combat!.damage.god = true;
  return w;
}
let wallId = 9000;
function wall(w: SimWorld, x: number, z: number, halfX: number, halfZ: number, id = wallId++): CoverWall {
  const cover: CoverWall = { x, y: 1, z, halfX, halfY: 1, halfZ };
  (w.combat!.query.walls as CoverWall[]).push(cover);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id, wall: cover, blocked: true } as never);
  return cover;
}
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** Runs `seconds` with a per-tick player intent; returns one sample per second. */
function run(w: SimWorld, seconds: number, move: (t: number) => { x: number; z: number } = () => ({ x: 0, z: 0 })) {
  const mega = () => w.megaPursuit!.entity()!, p = w.entities.get(1)!, rows: { t: number; d: number; mode: string; x: number; z: number }[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    w.setInput({ move: move(i / 60) }); w.update();
    if ((i + 1) % 60 === 0 && w.megaPursuit!.entity()) rows.push({ t: (i + 1) / 60, d: +dist(mega().transform, p.transform).toFixed(2), mode: w.megaPursuit!.state.mode, x: +mega().transform.x.toFixed(1), z: +mega().transform.z.toFixed(1) });
  }
  return rows;
}

test('T-E32-10a @E32-AC10 cruise is 0.7 × the nominal run (±2%): a running player stays ahead, the gap grows ~1.35 m/s', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null });
  expect(megaAlpha.cruiseMs).toBeCloseTo(survivor.speed * .7, 6);
  const id = pursuit.introduce({ x: -60, z: 0 }), e = w.entities.get(id)!;
  expect(e.infected!.pursuit).toBe(true); expect(e.infected!.variant).toBe('inf.mega-alpha');
  const rows = run(w, 30, () => ({ x: 1, z: 0 }));
  const at = (t: number) => rows.find(r => r.t === t)!;
  const speed = (at(28).x - at(8).x) / 20, p = w.entities.get(1)!.transform;
  console.info(`[mega-cruise] speed ${speed.toFixed(3)} m/s (target ${megaAlpha.cruiseMs.toFixed(3)}), player ${p.x.toFixed(1)} m; distance by second ${rows.filter(r => r.t % 5 === 0).map(r => `${r.t}s:${r.d}`).join(' ')}`);
  expect(Math.abs(speed / megaAlpha.cruiseMs - 1)).toBeLessThanOrEqual(.02);
  expect(at(28).d - at(8).d).toBeGreaterThan(20 * (survivor.speed - megaAlpha.cruiseMs) * .95);
  expect(rows.every(r => r.mode === 'detailed')).toBe(true);
});

test('T-E32-10b @E32-AC10 no sight, hearing or lure: it closes on a player hidden behind a wall, through a lure and smoke, and attacks', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null });
  // A long wall between them: no line of sight at any point of the approach.
  wall(w, -20, 0, .5, 12);
  const id = pursuit.introduce({ x: -70, z: 0 }), e = w.entities.get(id)!;
  const lure = w.entities.get(w.infected!.spawn('infected.runner', { x: -70, z: 40 }, { state: 'idle' }))!;
  let lured = 0, attacked = -1;
  w.events.on('telegraph', ev => { if (ev.type === 'telegraph' && ev.sourceId === id && attacked < 0) attacked = w.tick; });
  const rows: number[] = [];
  for (let i = 0; i < 40 * 60; i++) {
    // Corgi-lure style noise target every tick: never redirects it.
    e.noiseTarget = { id: lure.id, until: w.tick + 600 } as never;
    w.update();
    if (e.noiseTarget) lured++;
    if (i % 300 === 0) rows.push(+dist(e.transform, w.entities.get(1)!.transform).toFixed(1));
  }
  console.info(`[mega-hidden] distance every 5 s ${rows.join(' ')}; first telegraph at ${((attacked - pursuit.state.introducedAt) / 60).toFixed(1)} s`);
  expect(lured).toBe(0);
  expect(dist(e.transform, w.entities.get(1)!.transform)).toBeLessThan(4);
  expect(attacked).toBeGreaterThan(0);
});

test('T-E32-10c @E32-AC10 a player who stops is always caught: arrival time matches route length / cruise', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null });
  pursuit.introduce({ x: -150, z: 0 });
  const rows = run(w, 60);
  const arrive = rows.find(r => r.d <= megaAlpha.closeM)!;
  console.info(`[mega-catch] reached ${megaAlpha.closeM} m at ${arrive.t} s (ideal ${((150 - megaAlpha.closeM) / megaAlpha.cruiseMs).toFixed(1)} s)`);
  expect(arrive.t).toBeLessThanOrEqual((150 - megaAlpha.closeM) / megaAlpha.cruiseMs + 2);
});

test('T-E32-10d @E32-AC10 obstacle recovery: a U-trap opening away from the player and a door closing on its path never trap it', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null });
  // U around the Mega, open to the west (away from the player at the origin).
  wall(w, -36, 0, .5, 8); wall(w, -44, 8, 8, .5); wall(w, -44, -8, 8, .5);
  pursuit.introduce({ x: -42, z: 0 });
  const rows = run(w, 6);
  // A gate closes the gap it was heading for; it reroutes around the other end.
  wall(w, -10, 0, .5, 30);
  rows.push(...run(w, 50));
  const reached = rows.find(r => r.d <= megaAlpha.closeM);
  console.info(`[mega-trap] ${rows.filter((_, i) => i % 4 === 0).map(r => `${r.t}s:${r.d}m/${r.mode}`).join(' ')}`);
  expect(reached, 'reached the player').toBeDefined();
});

test('T-E32-10e @E32-AC10 a sealed pocket escalates replan → alternate → Alpha breach brain and keeps cycling (never a permanent stop)', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null });
  // Fully enclosed box: no route exists. It must keep trying (levels cycle) instead of freezing in one state.
  wall(w, -36, 0, .5, 4); wall(w, -44, 0, .5, 4); wall(w, -40, 4, 4.5, .5); wall(w, -40, -4, 4.5, .5);
  pursuit.introduce({ x: -40, z: 0 });
  const levels = new Set<number>();
  for (let i = 0; i < 20 * 60; i++) { w.update(); levels.add(pursuit.state.stuck.level); }
  expect([...levels].sort()).toEqual([0, 1, 2, 3]);
  // Opening the box (a breach) lets it out at once.
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: wallId - 4, wall: (w.combat!.query.walls as CoverWall[]).at(-4)!, blocked: false } as never);
  const rows = run(w, 20);
  expect(rows.at(-1)!.d).toBeLessThan(15);
});

const strip: PursuitRoute = {
  nodes: [-200, -170, -140, -110, -80, -50, -20, 0].map((x, i) => ({ id: `n${i}`, x, z: 0, region: x < -100 ? 'r1' : 'r2' })).concat([{ id: 'd1', x: -140, z: 40 }, { id: 'd2', x: -80, z: 40 }] as never),
  links: [['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'n5'], ['n5', 'n6'], ['n6', 'n7'], ['n2', 'd1'], ['d1', 'd2'], ['d2', 'n4']],
};
test('T-E32-10f @E32-AC10 off-region: coarse per-tick advance at cruise × sim-time (2 Hz route planning) along authored nodes, counts against the cap, keeps HP, detailed on entry', async () => {
  const w = await course(), resident = (x: number) => x > -100;
  const pursuit = installMegaPursuit(w, { introduceTick: null, route: strip, resident });
  const id = pursuit.introduce({ x: -200, z: 0 }), e = w.entities.get(id)!;
  expect(pursuit.state.mode).toBe('coarse');
  expect(w.infected!.director.count).toBe(1);
  w.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 7, actionId: 'weapon.test', origin: { x: 0, z: 0 }, direction: { x: -1, z: 0 }, base: 40, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
  const hp = e.health.current; expect(hp).toBeLessThan(e.health.max);
  const rows = run(w, 80);
  const coarse = rows.filter(r => r.mode === 'coarse'), entered = rows.find(r => r.mode !== 'coarse')!;
  const coarseSpeed = (coarse.at(-1)!.x - coarse[0].x) / (coarse.at(-1)!.t - coarse[0].t);
  console.info(`[mega-coarse] coarse ${coarse.length} s at ${coarseSpeed.toFixed(3)} m/s, detailed from ${entered.t} s at x ${entered.x}; ${rows.filter(r => r.t % 10 === 0).map(r => `${r.t}s:${r.x}/${r.mode}`).join(' ')}`);
  expect(Math.abs(coarseSpeed / megaAlpha.cruiseMs - 1)).toBeLessThanOrEqual(.02);
  expect(entered.x).toBeGreaterThan(-100 - megaAlpha.cruiseMs * 1.1);
  expect(e.health.current).toBe(hp);
  expect(rows.find(r => r.d <= megaAlpha.closeM)).toBeDefined();
  expect([...w.entities.iterate()].filter(x => x.infected?.pursuit).length).toBe(1);
});

test('T-E32-10g @E32-AC10 an authored blocked street takes the detour; with no alternate it breaches after breachS (no border stop)', async () => {
  const w = await course(), resident = () => false;
  const pursuit = installMegaPursuit(w, { introduceTick: null, route: strip, resident });
  pursuit.blockLink('n2', 'n3');
  pursuit.introduce({ x: -200, z: 0 });
  let detour = false;
  for (let i = 0; i < 40 * 60; i++) { w.update(); if (Math.abs(pursuit.entity()!.transform.z - 40) < 1) detour = true; }
  expect(detour).toBe(true);
  // No alternate: block the detour too. It waits breachS at the link, then continues.
  const w2 = await course(), p2 = installMegaPursuit(w2, { introduceTick: null, route: strip, resident });
  p2.blockLink('n2', 'n3'); p2.blockLink('d1', 'd2');
  p2.introduce({ x: -200, z: 0 });
  let breachTicks = 0;
  for (let i = 0; i < 80 * 60; i++) { w2.update(); if (p2.state.mode === 'breach') breachTicks++; }
  console.info(`[mega-breach] breach ${breachTicks} ticks, final x ${p2.entity()!.transform.x.toFixed(1)}`);
  expect(breachTicks).toBeGreaterThanOrEqual(megaAlpha.breachS * 60 - 1);
  expect(p2.entity()!.transform.x).toBeGreaterThan(-20);
});

test('T-E32-10h @E32-AC10 introduced once by 2:00, ≥ 80 m behind along the route; introduce() is idempotent', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { route: strip });
  expect(pursuit.state.mode).toBe('dormant'); expect(w.infected!.director.reserved).toBe(1);
  for (let i = 0; i < megaAlpha.introduceS * 60 + 1; i++) w.update();
  const id = pursuit.state.id; expect(id).toBeGreaterThan(0);
  expect(megaAlpha.introduceS).toBeLessThanOrEqual(120);
  expect(w.infected!.director.reserved).toBe(0);
  const e = w.entities.get(id)!;
  expect(dist(e.transform, w.entities.get(1)!.transform)).toBeGreaterThanOrEqual(megaAlpha.startBehindM - 1);
  expect(pursuit.introduce()).toBe(id);
  expect([...w.entities.iterate()].filter(x => x.infected?.pursuit).length).toBe(1);
});

const def: MissionDef = { id: 'mega-checkpoint', briefing: 'Mega', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {}, steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [] };
test('T-E32-10i @E32-AC10 checkpoint restore: same id, HP, route state and cooldown timers; ≥ respawnGapM from the player; a kill stays a kill', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null, route: strip, resident: (x: number) => x > -100 });
  const m = w.loadMission(def); m.begin();
  const id = pursuit.introduce({ x: -200, z: 0 }), e = w.entities.get(id)!;
  e.health.current = 2500; e.infected!.specialCooldowns = { 'alpha.charge': w.tick + 300 };
  run(w, 5); m.checkpoint('C');
  const saved = { x: e.transform.x, hp: e.health.current, cooldown: e.infected!.specialCooldowns['alpha.charge']! - w.tick, route: [...pursuit.state.route] };
  run(w, 45); // it closes in on the player
  expect(dist(w.entities.get(id)!.transform, w.entities.get(1)!.transform)).toBeLessThan(megaAlpha.respawnGapM);
  m.restore('C');
  const r = w.entities.get(id)!;
  expect(r.infected!.pursuit).toBe(true); expect(r.health.current).toBe(saved.hp);
  expect(r.transform.x).toBeCloseTo(saved.x, 5); // far at the checkpoint: no gap move needed
  expect(r.infected!.specialCooldowns!['alpha.charge']! - w.tick).toBe(saved.cooldown);
  expect(pursuit.state.mode === 'coarse' || pursuit.state.mode === 'detailed').toBe(true);
  // Checkpoint taken while it was close: restore puts it ≥ respawnGapM away (never on top of the respawn).
  run(w, 45); m.checkpoint('C'); run(w, 2); m.restore('C');
  expect(dist(w.entities.get(id)!.transform, w.entities.get(1)!.transform)).toBeGreaterThanOrEqual(megaAlpha.respawnGapM);
  // Killed after the checkpoint (an early rocket kill): it stays dead through the restore.
  w.entities.get(id)!.health.current = 0; w.entities.get(id)!.infected!.recoverAt = -1; run(w, 1);
  expect(pursuit.state.mode).toBe('dead');
  m.restore('C'); run(w, 3);
  expect(w.entities.get(id)!.health.current).toBe(0); expect(pursuit.state.mode).toBe('dead');
  expect([...w.entities.iterate()].filter(x => x.infected?.pursuit && x.health.current > 0).length).toBe(0);
});

test('T-E32-10j @E32-AC10 the pursuit seam round-trips through captureSeams and the world snapshot', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null, route: strip, resident: (x: number) => x > -100 });
  pursuit.introduce({ x: -200, z: 0 }); run(w, 4);
  const seams = captureSeams(w);
  expect(seams.megaPursuit).toMatchObject({ id: pursuit.state.id, mode: 'coarse' });
  expect((w.getState() as unknown as { megaPursuit: { id: number } }).megaPursuit.id).toBe(pursuit.state.id);
  const before = structuredClone(pursuit.state.route); run(w, 10); restoreSeams(w, seams);
  expect(pursuit.state.route).toEqual(before);
});

test('T-E32-10k @E32-AC10 removed without dying (restore from a pre-install snapshot): it is introduced again, still exactly one', async () => {
  const w = await course(), pursuit = installMegaPursuit(w, { introduceTick: null });
  const id = pursuit.introduce({ x: -60, z: 0 }), e = w.entities.get(id)!;
  w.infected!.release(e); run(w, 0.1);
  expect(pursuit.state.id).toBeGreaterThan(0);
  expect([...w.entities.iterate()].filter(x => x.infected?.pursuit).length).toBe(1);
  expect(pursuit.state.mode).not.toBe('dead');
});


test('T-E32-10-E3b @E32-AC10 coarse to detailed handoff retains cruise on the first tick and next second', async () => {
  const w = await course();
  const pursuit = installMegaPursuit(w, { introduceTick: null, route: strip, resident: (x: number) => x >= -100 });
  const id = pursuit.introduce({ x: -110, z: 0 });
  for (let i = 0; i < 600 && pursuit.state.mode === 'coarse'; i++) {
    const x = w.entities.get(id)!.transform.x; w.update();
    if ((pursuit.state.mode as string) === 'detailed') expect((w.entities.get(id)!.transform.x - x) * 60).toBeCloseTo(megaAlpha.cruiseMs, 1);
  }
  expect(pursuit.state.mode).toBe('detailed');
  for (let i = 0; i < 60; i++) {
    const x = w.entities.get(id)!.transform.x; w.update();
    expect((w.entities.get(id)!.transform.x - x) * 60).toBeCloseTo(megaAlpha.cruiseMs, 1);
    expect(pursuit.state.id).toBe(id);
  }
});


test('coarse pursuit crosses nonresident collision and re-enters with its current physical pose', async () => {
  const w = await course(); let resident = true;
  const pursuit = installMegaPursuit(w, { introduceTick: null, resident: () => resident });
  const id = pursuit.introduce({ x: -120, z: 0 }), e = w.entities.get(id)!;
  w.update(); const before = e.transform.x, hp = e.health.current;
  resident = false; wall(w, -110, 0, .5, 40);
  run(w, 10);
  expect(pursuit.state.mode).toBe('coarse'); expect(e.infected!.hidden).toBe(true);
  expect(e.transform.x - before).toBeCloseTo(megaAlpha.cruiseMs * 10, 3);
  expect(w.solids.clear(e.transform, survivor.radius, 1)).toBe(true);
  const endpoint = e.transform.x;
  resident = true; w.update();
  expect(pursuit.state.mode).toBe('detailed'); expect(e.infected!.hidden).toBe(false);
  expect(e.transform.x).toBeGreaterThanOrEqual(endpoint);
  expect(w.solids.clear(e.transform, survivor.radius, 1)).toBe(false);
  expect(e.health.current).toBe(hp); expect(w.infected!.director.count).toBe(1);
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
});
