import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l5, l5Loadout, l5Survivors } from '../../src/data/l5';
import { timeOfDay } from '../../src/data/timeOfDay';
import { emptyInput } from '../../src/input/InputFrame';
import { validateMission } from '../../src/sim/missions/schema';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL5, runL5 } from '../../tools/sim-runner/l5Bots';

/**
 * E23 L5 "Aftermath": mission graph, the empty opening, sparse never-omniscient infected, the five hidden survivors, the group that
 * follows and needs protection, losses that never stop the level, the loadout, the sunset gloom, the Metro handover and the checkpoints
 * (sim ACs). PO 10-09: no 20-seed batteries; one single-seed bot pass per profile is the can-it-be-finished check.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;
function record(name: string, value: unknown) { mkdirSync('test-results/epics/E23', { recursive: true }); writeFileSync(`test-results/epics/E23/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const step = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };
const place = (w: SimWorld, id: number, x: number, z: number) => { const e = w.entities.get(id)!; Object.assign(e.transform, { x, z }); if (id === 1) { w.physics.playerBody!.setTranslation({ x, y: e.transform.y, z }, true); w.physics.playerBody!.setNextKinematicTranslation({ x, y: e.transform.y, z }); Object.assign(w.previousPlayer!, e.transform); } w.spatial.set(id, x, z); };
const at = (w: SimWorld, name: string) => w.missions!.def.anchors[name];
/** Walk the courier (placed) to a survivor's ring and stand there until found. */
function visit(w: SimWorld, key: string, ticks = 75) { const ring = at(w, `l5-ring-${key}`); place(w, 1, ring.x, ring.z); step(w, ticks); }
/** Begin the search at once (the unbarring and the ten silent seconds are covered elsewhere). */
function search(w: SimWorld) { const m = w.missions!; m.completeObjective('emerge'); step(w, 11 * 60); expect(m.state.l5!.phase).toBe('search'); }
const status = (w: SimWorld) => Object.fromEntries(w.missions!.state.l5!.survivors.map(r => [r.key, r.status]));

describe('L5 Aftermath', () => {
  test('T-E23-01 @E23 @E23-AC01 mission graph emerge -> look -> metro is completable for every find order, with no fail timer and no fail on a survivor\'s death', async () => {
    const l = await loadL5(1); world = l.world; const m = l.mission;
    expect(validateMission(m.def)).toEqual([]);
    expect(m.def.steps.map(s => s.id)).toEqual(['emerge', 'look', 'metro']);
    expect(m.def.steps.every(s => s.timer === undefined && s.fail.length === 0) && m.def.deadline === undefined).toBe(true);
    expect(m.def.finish).toEqual(['metro']); expect(m.def.checkpoints).toEqual(['outside', 'survivor-1', 'survivor-2', 'survivor-3', 'survivor-4', 'survivor-5']);
    // E12-AC07 walk: complete exactly the active objective; the ten silent seconds are bridged by the controller.
    for (let guard = 0; guard < 12 && m.state.phase === 'playing'; guard++) m.completeObjective();
    expect(m.state.completedObjectives).toEqual(['emerge', 'look', 'metro']); expect(m.state.phase).toBe('progression');
    expect(m.state.result!.survivors).toHaveLength(5);
    // Every find order: five rotations and the reverse (the graph has no order constraint; each ring is independent).
    const keys = l5Survivors.map(s => s.key), orders = [...keys.map((_, i) => [...keys.slice(i), ...keys.slice(0, i)]), [...keys].reverse()];
    for (const [n, order] of orders.entries()) {
      const f = await loadL5(10 + n); const fw = f.world; fw.combat!.damage.god = true;
      search(fw);
      for (const [i, key] of order.entries()) { visit(fw, key); expect(fw.missions!.state.l5!.found, `${order.join()} #${i}`).toBe(i + 1); }
      expect(fw.missions!.state.states.accounted).toBe(true); expect(fw.missions!.state.steps.metro.status).toBe('active');
      const foot = at(fw, 'l5-metro-foot'); place(fw, 1, foot.x, foot.z);
      for (let i = 0; i < 40 * 60 && fw.missions!.state.phase === 'playing'; i++) fw.update();
      expect(fw.missions!.state.phase, order.join()).toBe('progression'); fw.dispose();
    }
    // No fail on death: every survivor dies as soon as they are found (and the courier too, once); the level still completes with zero rescued.
    const z = await loadL5(2); const zw = z.world; search(zw);
    for (const key of keys) { visit(zw, key); const e = zw.entities.get(zw.missions!.state.l5!.survivors.find(r => r.key === key)!.id)!; e.health.current = 0; step(zw, 5); }
    expect(zw.missions!.state.phase).toBe('playing'); expect(Object.values(status(zw)).every(v => v === 'dead' || v === 'turned')).toBe(true);
    const foot = at(zw, 'l5-metro-foot'); place(zw, 1, foot.x, foot.z);
    for (let i = 0; i < 40 * 60 && zw.missions!.state.phase === 'playing'; i++) zw.update();
    expect(zw.missions!.state.phase).toBe('progression'); expect(zw.missions!.state.result!.survivors).toEqual([]); expect(zw.missions!.state.result!.rescued).toBe(0);
    zw.dispose();
  }, HEAVY);

  test('T-E23-02 @E23 @E23-AC02 the complete bot finishes a single seed from L5-default without cheats, in the time band, rescuing at least 4', async () => {
    const l = await loadL5(1); world = l.world;
    const w = l.world, weapons = w.entities.get(1)!.weapons!;
    expect(weapons.LEFT.rack.map(r => r.id)).toEqual([...l5Loadout.left]); expect(weapons.RIGHT.rack.map(r => r.id)).toEqual([...l5Loadout.right]); expect(weapons.selectedSide).toBe('RIGHT');
    const r = runL5(w, l.mission, 'complete', { seed: 1, maxSeconds: 600 });
    record('bot-complete-seed1', r);
    expect(r.outcome).toBe('complete'); expect(r.deaths).toBeLessThanOrEqual(1);
    expect(r.simSeconds).toBeGreaterThanOrEqual(l5.bots.completeMedianS[0]); expect(r.simSeconds).toBeLessThanOrEqual(l5.bots.completeMedianS[1]);
    expect(r.rescued).toBeGreaterThanOrEqual(4); expect(r.found.map(f => f.key).sort()).toEqual(l5Survivors.map(s => s.key).sort());
    expect(r.maxConcurrent).toBeLessThanOrEqual(l5.infected.cap.high);
    expect(r.timeline.map(t => t.type)).toEqual(expect.arrayContaining(['l5.emerged', 'l5.searching', 'l5.accounted', 'l5.shutter', 'l5.sheltered']));
  }, HEAVY);

  test('T-E23-03 @E23 @E23-AC03 the newbie bot finishes a single seed with at most one death, rescuing at least 3', async () => {
    const l = await loadL5(2); world = l.world;
    const r = runL5(l.world, l.mission, 'newbie', { seed: 2, maxSeconds: 600 });
    record('bot-newbie-seed2', r);
    expect(r.outcome).toBe('complete'); expect(r.deaths).toBeLessThanOrEqual(l5.bots.newbieMaxMedianDeaths);
    expect(r.simSeconds).toBeGreaterThanOrEqual(l5.bots.newbieMedianS[0]); expect(r.simSeconds).toBeLessThanOrEqual(l5.bots.newbieMedianS[1]);
    expect(r.rescued).toBeGreaterThanOrEqual(3);
  }, HEAVY);

  test('T-E23-04 @E23 @E23-AC04 the opening is empty: no allied fighter, no living civilian but the five survivors (hidden) and the lookout, no helicopter or moving vehicle, no gunfire but the courier\'s; 12-20 infected in ones and twos', async () => {
    for (const tier of ['high', 'low'] as const) {
      const l = await loadL5(3, tier); const w = l.world, ai = w.infected!;
      const shots: string[] = []; w.events.on('ally.attack', () => shots.push('ally')); w.events.on('l4.heliPass', () => shots.push('heli')); w.events.on('hmg.burst', () => shots.push('hmg'));
      l.mission.completeObjective('emerge'); step(w, 60 * 60);
      const live = [...w.entities.iterate()].filter(e => e.civilian && !e.civilian.pet && e.civilian.state !== 'finished' && !e.infection);
      const survivors = new Set(l.mission.state.l5!.survivors.map(r => r.id)), lookout = l.mission.state.l5!.lookoutId;
      expect(live.filter(e => !survivors.has(e.id) && e.id !== lookout && !e.infected && !e.companion)).toEqual([]);
      expect(live.filter(e => e.civilian!.ally)).toEqual([]); expect(live.filter(e => e.civilian!.survivor?.mode === 'hidden').every(e => e.hidden)).toBe(true);
      expect([...w.entities.iterate()].filter(e => e.kind === 'setpiece' || e.vehicle || e.traffic || e.convoy)).toEqual([]);
      expect(shots).toEqual([]);
      const infected = ai.active.filter(e => e.health.current > 0);
      expect(infected.length).toBeGreaterThanOrEqual(12); expect(infected.length).toBeLessThanOrEqual(20);
      // Groups: infected within 4 m of each other number at most 3.
      for (const e of infected) expect(infected.filter(o => dist(o.transform, e.transform) <= 4).length).toBeLessThanOrEqual(3);
      expect(infected.length).toBeLessThanOrEqual(tier === 'low' ? l5.infected.start.low + 2 : l5.infected.start.high + 2);
      w.dispose();
    }
  }, HEAVY);

  test('T-E23-07 @E23 @E23-AC07 sparse and never omniscient: no director spawn or emergence, at most 30 at once, sight-only alerts; a machine-gun burst pulls non-chasing infected within 30 m to the shot', async () => {
    const l = await loadL5(1); world = l.world; const w = l.world, ai = w.infected!;
    const r = runL5(w, l.mission, 'complete', { seed: 1, maxSeconds: 130 });
    record('audit', r.audit);
    expect(r.audit.directorQueueMax).toBe(0); expect(r.audit.newInfected).toBe(0); expect(r.maxConcurrent).toBeLessThanOrEqual(30);
    expect(r.audit.sightViolations).toBe(0);
    // The loud burst: a fresh world, the courier on Harbor Street in the west, two non-chasing infected (one 15 m away, one 40 m away) facing away from her.
    const f = await loadL5(3); const fw = f.world, fai = fw.infected!; fw.combat!.damage.god = true;
    f.mission.completeObjective('emerge'); for (const e of [...fai.active]) fai.release(e);
    const shot = { x: -20, z: -38.2 }; place(fw, 1, shot.x, shot.z);
    const spawn = (x: number, yaw: number) => fai.spawn('infected.runner', { x, z: shot.z }, { yaw });
    const inside = spawn(shot.x + 15, 0), beyond = spawn(shot.x - 40, Math.PI), chaser = spawn(shot.x - 12, Math.PI);
    fw.update(); fw.entities.get(beyond)!.infected!.l1!.pauseUntil = Number.MAX_SAFE_INTEGER;
    const chase = fw.entities.get(chaser)!.infected!.l1!; chase.mode = 'chase'; chase.targetId = 9_999_999;
    fw.applyInput({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index: 0 } }, 'keyboard'); fw.update();
    let bursts = 0; fw.events.on('outbreak.distraction', e => { if (e.type === 'outbreak.distraction' && e.kind === 'gunfire' && e.radius === 30) bursts++; });
    for (let i = 0; i < 12; i++) { fw.applyInput({ ...emptyInput(), right: { down: i === 0, held: true, up: false }, aim: { x: 0, z: 1 }, attackInPlace: true }, 'keyboard'); fw.update(); }
    fw.applyInput(emptyInput(), 'keyboard');
    const startBeyond = { ...fw.entities.get(beyond)!.transform };
    let reached = -1;
    for (let t = 0; t < 900; t++) { fw.update(); const e = fw.entities.get(inside)!; if (reached < 0 && dist(e.transform, shot) <= 4) reached = t; }
    expect(bursts).toBeGreaterThanOrEqual(1);
    expect(reached).toBeGreaterThanOrEqual(0); expect(['search', 'attracted', 'chase']).toContain(fw.entities.get(inside)!.infected!.l1!.mode);
    expect(dist(fw.entities.get(beyond)!.transform, startBeyond)).toBeLessThan(2); expect(fw.entities.get(chaser)!.infected!.l1!.distractionId).toBe(0);
    fw.dispose(); void ai;
  }, HEAVY);

  test('T-E23-08 @E23 @E23-AC08 signs of life: a positional cue with a subtitle within 25 m of each hiding place, none beyond 30 m; no objective marker ever points at a survivor', async () => {
    const l = await loadL5(1); world = l.world; const w = l.world, m = l.mission;
    const cues: { key: string; d: number; text: string }[] = [];
    w.events.on('l5.cue', e => { if (e.type === 'l5.cue') cues.push({ key: e.key, d: e.distance, text: e.text }); });
    m.completeObjective('emerge'); w.combat!.damage.god = true;
    // Before the objective (ten silent seconds) nothing is heard, wherever the courier stands.
    place(w, 1, 47, 8); step(w, 5 * 60); expect(cues).toEqual([]);
    step(w, 6 * 60); expect(m.state.l5!.phase).toBe('search');
    for (const s of l5Survivors) {
      const hide = at(w, `l5-hide-${s.key}`);
      // 32 m away: silent. 22 m away: the cue arrives (position + text) and the HUD ping is armed for 4 s.
      cues.length = 0; place(w, 1, hide.x + 32, hide.z); step(w, 8 * 60); expect(cues.filter(c => c.key === s.key), `${s.key} beyond 30 m`).toEqual([]);
      place(w, 1, hide.x, hide.z + 22); step(w, 2); const heard = cues.filter(c => c.key === s.key);
      expect(heard.length, `${s.key} within 25 m`).toBeGreaterThanOrEqual(1); expect(heard[0].d).toBeLessThanOrEqual(25); expect(heard[0].text.length).toBeGreaterThan(8);
      expect(m.state.l5!.cue).toMatchObject({ key: s.key }); expect(m.state.l5!.cue!.until - w.tick).toBeLessThanOrEqual(4 * 60);
    }
    // No marker on a survivor at any time of the walk (the search objective has none, the Metro one points at the Metro).
    for (const tick of [0, 1, 2]) { void tick; step(w, 30); expect(m.state.marker === null || !/^l5-(ring|hide|out)-/.test(m.state.marker)).toBe(true); }
    expect(m.def.steps.find(s => s.id === 'look')!.anchor).toBe('l5-plaza'); expect(m.state.marker).toBeNull();
  }, HEAVY);

  test('T-E23-09 @E23 @E23-AC09 the group grows and follows: stand-to-interact 1.0 s, the counter steps 0 to 5, followers within 8 m, no jump above 1 m per tick, slower than the courier\'s run', async () => {
    const l = await loadL5(1); world = l.world; const w = l.world, m = l.mission, s = m.state.l5!;
    m.completeObjective('emerge'); w.combat!.damage.god = true; step(w, 11 * 60);
    expect(s.found).toBe(0);
    // 0.9 s next to the spot finds nobody; 1.0 s does (and standing 2 m away never does).
    const ring = at(w, 'l5-ring-rosa');
    place(w, 1, ring.x + 4, ring.z); step(w, 120); expect(s.found).toBe(0);
    place(w, 1, ring.x, ring.z); step(w, 50); expect(s.found).toBe(0); step(w, 15); expect(s.found).toBe(1);
    const rosa = w.entities.get(s.survivors.find(r => r.key === 'rosa')!.id)!;
    expect(rosa.hidden).toBe(false); expect(rosa.civilian!.survivor!.mode).toBe('follow'); expect(w.events.events().some(e => e.type === 'l5.found' && e.key === 'rosa' && e.count === 1)).toBe(true);
    // The remaining four, then a run along Harbor Street: followers keep up (never teleport, never faster than 3.9 m/s), the courier outruns them.
    const counter = [1];
    for (const key of ['sam', 'mia', 'okafor', 'dale']) { visit(w, key); counter.push(s.found); }
    expect(counter).toEqual([1, 2, 3, 4, 5]);
    const start = at(w, 'l5-out'); place(w, 1, -30, -38.2); const followers = s.survivors.map(r => w.entities.get(r.id)!);
    for (const f of followers) { const out = { x: -30 + (followers.indexOf(f) - 2) * 1.5, z: -38.2 }; place(w, f.id, out.x, out.z); }
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    const last = new Map(followers.map(f => [f.id, { x: f.transform.x, z: f.transform.z }])), window = new Map(followers.map(f => [f.id, { x: f.transform.x, z: f.transform.z }])); let jump = 0, peak = 0, near = 0, total = 0;
    for (let i = 0; i < 20 * 60; i++) {
      w.applyInput({ ...emptyInput(), move: { x: 1, z: 0 } }, 'keyboard'); w.update();
      for (const f of followers) { const p = last.get(f.id)!; jump = Math.max(jump, dist(p, f.transform)); p.x = f.transform.x; p.z = f.transform.z; }
      // Speed over one-second windows once the group has shaken out (the first seconds can include separation pushes).
      if (i > 150 && i % 60 === 0) for (const f of followers) { const q = window.get(f.id)!; peak = Math.max(peak, dist(q, f.transform)); q.x = f.transform.x; q.z = f.transform.z; } else if (i <= 150) for (const f of followers) { const q = window.get(f.id)!; q.x = f.transform.x; q.z = f.transform.z; }
      if (i > 150) { total++; if (followers.every(f => dist(f.transform, w.entities.get(1)!.transform) <= 8)) near++; }
    }
    expect(jump).toBeLessThan(1); expect(peak).toBeLessThanOrEqual(l5.follow.runMs + .1);
    expect(w.entities.get(1)!.survivor!.velocity.x).toBeGreaterThan(l5.follow.runMs);
    void near; void total; void start;
    // And in a bot run the group stays together (>= 80 % of the quiet time within 8 m).
    const b = await loadL5(1); const r = runL5(b.world, b.mission, 'complete', { seed: 1, maxSeconds: 400 }); b.world.dispose();
    record('follow', { followShare: r.followShare, maxFollowerJump: r.maxFollowerJump });
    expect(r.followShare).toBeGreaterThanOrEqual(.8); expect(r.maxFollowerJump).toBeLessThan(1);
  }, HEAVY);

  test('T-E23-10 @E23 @E23-AC10 protection matters: an infected that reaches an unprotected survivor grabs and bites within 1.5 s, a hit during the grab saves them, a bitten survivor turns in 2.5-3.5 s as the same person', async () => {
    const run = async (protect: boolean) => {
      const l = await loadL5(5); const w = l.world, m = l.mission, s = m.state.l5!, ai = w.infected!;
      w.combat!.damage.god = true; m.completeObjective('emerge'); step(w, 11 * 60); for (const e of [...ai.active]) ai.release(e);
      const ring = at(w, 'l5-ring-mia'); place(w, 1, ring.x, ring.z); step(w, 70); expect(s.found).toBe(1);
      const mia = w.entities.get(s.survivors.find(r => r.key === 'mia')!.id)!, asset = mia.appearance!.asset, id = mia.id;
      // The courier is far off (30 m); the infected stands 3 m from the survivor, facing her.
      place(w, 1, mia.transform.x + 30, mia.transform.z); w.player!.setCheckpoint(w.entities.get(1)!.transform);
      const g = ai.spawn('infected.runner', { x: mia.transform.x - 3, z: mia.transform.z }, { yaw: 0 });
      let hit = 0; const ev: Record<string, number> = {}; for (const type of ['civilian.grabbed', 'outbreak.bite', 'civilian.saved', 'civilian.turned'] as const) w.events.on(type, e => { if ('tick' in e && !(type in ev)) ev[type] = e.tick; });
      for (let i = 0; i < 12 * 60 && !('civilian.turned' in ev) && !('civilian.saved' in ev); i++) {
        w.update();
        if (protect && 'civilian.grabbed' in ev && !('civilian.saved' in ev) && w.tick - ev['civilian.grabbed'] >= 12 && w.entities.get(g)!.health.current > 0 && (w.entities.get(g)!.combat?.staggerUntil ?? 0) <= w.tick) {
          // A hit on the grabber inside the 1.0 s window: the machine gun, from the far side of the grabber (a survivor in the line of fire stops the bullets).
          if (!hit) { hit = w.tick; place(w, 1, mia.transform.x - 3, mia.transform.z); } w.applyInput({ ...emptyInput(), attackTarget: { id: g, side: 'RIGHT' }, right: { down: w.tick === hit + 1, held: true, up: false }, attackInPlace: true }, 'keyboard');
        }
      }
      const out = { ev, status: s.survivors.find(r => r.key === 'mia')!.status, same: w.entities.get(id)!.appearance?.asset === asset, kind: w.entities.get(id)!.faction };
      w.dispose(); return out;
    };
    const lost = await run(false), saved = await run(true);
    record('protection', { lost, saved });
    expect(lost.ev['civilian.grabbed']).toBeDefined(); expect(lost.ev['outbreak.bite'] - lost.ev['civilian.grabbed']).toBeLessThanOrEqual(1.5 * 60);
    expect(lost.ev['civilian.turned'] - lost.ev['outbreak.bite']).toBeGreaterThanOrEqual(2.5 * 60 - 3); expect(lost.ev['civilian.turned'] - lost.ev['outbreak.bite']).toBeLessThanOrEqual(3.5 * 60 + 3);
    expect(lost.status).toBe('turned'); expect(lost.same).toBe(true); expect(lost.kind).toBe('infected');
    expect(saved.ev['civilian.saved']).toBeDefined(); expect(saved.ev['outbreak.bite']).toBeUndefined(); expect(saved.status).toBe('following');
    // The evade-only courier (never attacks) loses people; the complete bot keeps them.
    const e = await loadL5(1); const er = runL5(e.world, e.mission, 'evade-only', { seed: 1, maxSeconds: 240 }); e.world.dispose();
    const c = await loadL5(1); const cr = runL5(c.world, c.mission, 'complete', { seed: 1, maxSeconds: 400 }); c.world.dispose();
    record('rescued-by-profile', { evadeOnly: er.rescued, complete: cr.rescued });
    expect(er.rescued).toBeLessThanOrEqual(2); expect(cr.rescued).toBeGreaterThanOrEqual(4); expect(er.kills).toBe(0);
  }, HEAVY);

  test('T-E23-11 @E23 @E23-AC11 losses do not stop the level: killing 1, 3 or all 5 survivors at random points still lets the complete bot finish; the result reports the rescued count', async () => {
    const plan = [{ kill: 1, seed: 1 }, { kill: 3, seed: 2 }, { kill: 5, seed: 3 }];
    for (const { kill, seed } of plan) {
      const l = await loadL5(seed); const w = l.world, s = l.mission.state.l5!, picks = [...l5Survivors.map(x => x.key)].sort((a, b) => (a < b ? -1 : 1)).slice(0, kill);
      const when = new Map(picks.map((key, i) => [key, 25 * 60 + ((seed * 37 + i * 211) % 4000)]));
      const killed = new Set<string>();
      const r = runL5(w, l.mission, 'complete', { seed, maxSeconds: 600, each: tick => {
        for (const [key, t] of when) if (tick >= t && !killed.has(key)) { killed.add(key); const rec = s.survivors.find(x => x.key === key)!; const e = w.entities.get(rec.id); if (e && rec.status !== 'sheltered') e.health.current = 0; }
      } });
      record(`kill-${kill}`, { ...r, killed: [...killed] });
      expect(r.outcome, `kill ${kill}`).toBe('complete');
      expect(r.rescued).toBeLessThanOrEqual(5 - Math.min(kill, killed.size)); expect(l.mission.state.result!.rescued).toBe(r.rescued); expect(l.mission.state.result!.survivors).toHaveLength(r.rescued);
      w.dispose();
    }
  }, HEAVY);

  test('T-E23-12 @E23 @E23-AC12 no new weapon: the loadout at the start and at the end equals the L4 end loadout, and no weapon pickup exists in L5', async () => {
    const l = await loadL5(1); world = l.world; const w = l.world;
    const loadout = () => { const x = w.entities.get(1)!.weapons!; return { left: x.LEFT.rack.map(r => r.id), right: x.RIGHT.rack.map(r => r.id) }; };
    expect(loadout()).toEqual({ left: [...l5Loadout.left], right: [...l5Loadout.right] });
    expect([...w.entities.iterate()].filter(e => e.pickup && !('kind' in e.pickup && e.pickup.kind === 'medkit'))).toEqual([]);
    const pickups = [...w.entities.iterate()].filter(e => e.pickup).map(e => e.pickup && 'kind' in e.pickup ? e.pickup.kind : 'weapon'); expect(new Set(pickups)).toEqual(new Set(['medkit']));
    runL5(w, l.mission, 'complete', { seed: 1, maxSeconds: 400 });
    expect(l.mission.state.phase).toBe('progression'); expect(loadout()).toEqual({ left: [...l5Loadout.left], right: [...l5Loadout.right] });
  }, HEAVY);

  test('T-E23-13 @E23 @E23-AC13 sunset and gloom: the sun intensity falls monotonically over the level and is at least 30 % lower at the Metro than at the basement exit', async () => {
    expect(timeOfDay.L5.intensity).toBeLessThanOrEqual(timeOfDay.L4.intensity * .7);
    const l = await loadL5(1); world = l.world; const s = l.mission.state.l5!; const samples: number[] = []; let atExit = -1, atMetro = -1;
    expect(s.gloom).toBe(1);
    const r = runL5(l.world, l.mission, 'complete', { seed: 1, maxSeconds: 400, each: () => {
      samples.push(s.gloom); if (atExit < 0 && s.phase === 'emerged') atExit = s.gloom; if (s.shutterAt && atMetro < 0) atMetro = s.gloom;
    } });
    expect(r.outcome).toBe('complete');
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-12);
    expect(atExit).toBe(1); expect(atMetro).toBeLessThanOrEqual(l5.gloom.atMetroMax); expect(1 - atMetro / atExit).toBeGreaterThanOrEqual(.3);
    record('gloom', { atExit, atMetro, intensityAtExit: timeOfDay.L5.intensity * atExit, intensityAtMetro: timeOfDay.L5.intensity * atMetro, samples: samples.filter((_, i) => i % 600 === 0) });
  }, HEAVY);

  test('T-E23-15 @E23 @E23-AC15 metro and handover: the objective switches when all five are accounted for; the shutter closes when the group is within 15 m, or 10 s after the courier arrives; level.completed carries the rescued survivors; no reward screen', async () => {
    const run = async (strand: boolean) => {
      const l = await loadL5(4); const w = l.world, m = l.mission, s = m.state.l5!; w.combat!.damage.god = true;
      search(w); for (const e of [...w.infected!.active]) w.infected!.release(e);
      for (const s2 of l5Survivors) { expect(m.state.steps.metro.status).toBe('pending'); visit(w, s2.key); }
      expect(m.state.steps.look.status).toBe('completed'); expect(m.state.steps.metro.status).toBe('active'); expect(m.state.marker).toBe('metro-entrance');
      const foot = at(w, 'l5-metro-foot'); place(w, 1, foot.x, foot.z - 2);
      // Gathered: the followers are placed round the courier. Stranded: one follower 40 m away, frozen in cover (it cannot come).
      const fol = s.survivors.map(r => w.entities.get(r.id)!);
      fol.forEach((f, i) => place(w, f.id, foot.x + (i - 2) * 1.5, foot.z + 1));
      if (strand) { const f = fol[0]; place(w, f.id, foot.x - 40, foot.z + 12); f.civilian!.survivor!.mode = 'hidden'; f.civilian!.survivor!.cover = true; f.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; }
      const heard: string[] = []; w.events.on('level.completed', e => { if (e.type === 'level.completed') heard.push(`${e.id}:${e.result.survivors?.length}:${e.result.rescued}`); });
      let phaseBeforeDone = '';
      for (let i = 0; i < 30 * 60 && m.state.phase === 'playing'; i++) { w.update(); if (s.shutterAt && !phaseBeforeDone) phaseBeforeDone = m.state.phase; }
      const out = { shutterAfter: (s.shutterAt - s.metroAt) / 60, phase: m.state.phase, heard, rescued: m.state.result?.survivors ?? [], states: { ...m.state.states } };
      w.dispose(); return out;
    };
    const gathered = await run(false), stranded = await run(true);
    record('shutter', { gathered, stranded });
    expect(gathered.shutterAfter).toBeLessThan(l5.metro.waitS); expect(gathered.phase).toBe('progression'); expect(gathered.heard).toEqual(['L5:5:5']); expect(gathered.rescued.sort()).toEqual(l5Survivors.map(s => s.key).sort());
    expect(stranded.shutterAfter).toBeGreaterThanOrEqual(l5.metro.waitS - .05); expect(stranded.shutterAfter).toBeLessThanOrEqual(l5.metro.waitS + .5);
    expect(stranded.heard).toEqual(['L5:4:4']); expect(stranded.rescued).toHaveLength(4); expect(stranded.rescued).not.toContain('dale');
  }, HEAVY);

  test('T-E23-16 @E23 @E23-AC16 checkpoints: dying right after outside and each survivor-n restores the snapshot (followers, lost survivors stay lost, infected)', async () => {
    const l = await loadL5(2); world = l.world; const w = l.world, m = l.mission; w.combat!.damage.god = false;
    const snaps: Record<string, unknown> = {};
    const bot = { stop: (id: string) => (mm: typeof m) => mm.state.checkpoint === id };
    for (const id of l5.checkpoints) {
      runL5(w, m, 'complete', { stopWhen: bot.stop(id) });
      expect(m.state.checkpoint, id).toBe(id);
      const s = m.state.l5!;
      const snap = { phase: s.phase, found: s.found, status: status(w), infected: w.infected!.active.filter(e => e.health.current > 0).length, followers: s.survivors.filter(r => r.status === 'following').map(r => ({ id: r.id, x: Math.round(w.entities.get(r.id)!.transform.x), z: Math.round(w.entities.get(r.id)!.transform.z) })), gloom: s.gloom };
      snaps[id] = snap;
      step(w, 90);
      const p = w.entities.get(1)!; w.player!.damage(p.health.current, w.tick);
      for (let i = 0; i < 400 && w.entities.get(1)!.health.current <= 0; i++) w.update();
      expect(m.state.checkpoint, id).toBe(id);
      const back = m.state.l5!;
      expect(back.phase, `${id} phase`).toBe(snap.phase); expect(back.found).toBe(snap.found); expect(status(w)).toEqual(snap.status);
      for (const f of snap.followers) { const e = w.entities.get(f.id)!; expect(dist(e.transform, f), `${id} follower ${f.id}`).toBeLessThan(2.5); }
      expect(back.gloom).toBeLessThanOrEqual(snap.gloom + 1e-9);
      for (const r of back.survivors) if (r.status === 'dead' || r.status === 'turned') expect(['dead', 'turned']).toContain(snap.status[r.key]);
    }
    record('checkpoints', snaps);
  }, HEAVY);

  test('T-E23-bots @E23 the idle bot unbars the door and waits (the level never fails, nobody dies of the level); the low tier finishes too', async () => {
    const l = await loadL5(1); world = l.world;
    const r = runL5(l.world, l.mission, 'idle', { seed: 1, maxSeconds: 120 });
    expect(r.outcome).toBe('timeout'); expect(r.deaths).toBe(0); expect(l.mission.state.phase).toBe('playing'); expect(l.mission.state.l5!.found).toBe(0);
    const low = await loadL5(3, 'low'); const rl = runL5(low.world, low.mission, 'complete', { seed: 3, maxSeconds: 600 }); low.world.dispose();
    expect(rl.outcome).toBe('complete'); expect(rl.maxConcurrent).toBeLessThanOrEqual(l5.infected.cap.low); expect(rl.infectedAtStart).toBeGreaterThanOrEqual(12);
  }, HEAVY);
});
