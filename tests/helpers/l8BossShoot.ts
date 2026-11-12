import { expect } from 'vitest';
import { l8BossArenas } from '../../src/data/l8Bosses';
import { objectiveText, l8SanctuaryResting } from '../../src/sim/missions/objectiveText';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { missionControls } from '../../src/sim/missions/controls';
import { loadLevel } from '../qa/invariants/world';
import { emptyInput } from '../../src/input/InputFrame';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { SimWorld } from '../../src/sim/world/SimWorld';

/** Convert every animal of the arena to a boss through the production turn path. */
export function turnArena(w: SimWorld, id: string): EntitySnapshot[] {
  const zoo = w.missions!.l8!, arena = zoo.state.arenas.find(a => a.id === id)!;
  // r32-animalmoves: the old elephant stays a living animal until the gorilla arena is cleared; clear it first so he can turn.
  if (id === 'elephant') for (const a of zoo.state.arenas) if (a.id === 'gorilla') a.phase = 3;
  for (const animalId of arena.ids) w.npcs!.civilians.outbreak!.infect(w.entities.get(animalId)!, 1);
  w.combat!.damage.god = true;
  for (let i = 0; i < 1500 && !arena.ids.every(a => w.entities.get(a)?.infected?.arenaBoss); i++) w.update();
  return arena.ids.map(a => w.entities.get(a)!);
}
/** Shoot `target` from `range` along the first clear bearing; returns damage dealt by the real weapon pipeline. */
export function shoot(w: SimWorld, target: EntitySnapshot, weapon: string, range: number, pin: () => void): { damage: number; fired: boolean; shots: number; noLine?: boolean } {
  const player = w.entities.get(1)!, q = w.combat!.query;
  pin(); // Establish the fixture pose before choosing the firing bearing.
  const goal = { x: target.transform.x, z: target.transform.z }, hp = target.health.current;
  let last: { damage: number; fired: boolean; shots: number } | undefined;
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, at = { x: goal.x + Math.cos(a) * range, z: goal.z + Math.sin(a) * range };
    if (q.clearDistance({ x: at.x, y: 1, z: at.z }, { x: -Math.cos(a), z: -Math.sin(a), y: 0 }, range, target.id, .6) < range - .3) continue;
    if (!w.solids.relocate(player, { ...at, y: (w.districts?.groundHeight(at.x, at.z) ?? 0) + .72 }, 'fixture.l8-boss-damage', 1.5, false)) continue;
    const aim = { x: -Math.cos(a), z: -Math.sin(a) };
    w.clearInput(); w.setInput({ ...emptyInput(), aim, aimPoint: goal, left: { down: true, held: true, up: false } });
    w.combat!.setLoadout([weapon], ['weapon.kick']);
    const start = w.tick;
    for (let t = 0; t < 70; t++) { pin(); w.update(); if (t === 0) w.clearInput(); }
    const events = w.events.events().filter(e => e.tick >= start);
    const shots = events.filter(e => e.type === 'combat.attack' && e.sourceId === 1).length, fired = shots > 0;
    if (process.env.L8_DEBUG) console.log(weapon, range, 'dist', Math.hypot(player.transform.x - goal.x, player.transform.z - goal.z).toFixed(2), events.filter(e => e.type.startsWith('combat.')).map(e => e.type + ('targetId' in e ? ':' + e.targetId : '')).join(','));
    if (process.env.L8_DEBUG && weapon.includes('rocket') && hp - target.health.current <= 0) console.log('ROCKET', JSON.stringify({ target: target.id, at: goal, player: player.transform, y: target.transform.y, radius: target.combat?.radius, arch: target.archetype, types: events.filter(e => e.type.startsWith('combat.') || e.type.startsWith('projectile')).map(e => e.type), proj: w.combat!.projectiles.map(p => JSON.stringify(p).slice(0, 300)) }).slice(0, 1500));
    const damage = hp - target.health.current;
    // A shot into scenery the line test cannot see (rocket duds, props) is retried from the next bearing; immunity must fail on all 16.
    if (damage <= 0 && !(weapon.includes('rocket') && range < 5)) { last = { damage, fired, shots }; continue; }
    return { damage, fired, shots };
  }
  return last ?? { damage: 0, fired: false, shots: 0, noLine: true };
}


const WEAPONS = ['weapon.pistol', 'weapon.shotgun', 'weapon.assault-rifle', 'weapon.army-mg', 'weapon.rocket-launcher'] as const;
type Start = (e: EntitySnapshot, move: string, windup: number, range: number, radius: number) => void;
const dispose = (w: SimWorld) => w.dispose();

/** r25-l8cues: every L8 boss type takes damage from every firearm at 2 m and 8 m; the rocket refuses inside 5 m. */
export async function checkBossDamage(): Promise<void> {
  const w = await loadLevel('L8', 1);
  try {
  const w = await loadLevel('L8', 1); 
  const zoo = w.missions!.l8!;
  zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  const failures: string[] = [];
  for (const def of l8BossArenas) {
    const bosses = turnArena(w, def.id);
    for (const boss of bosses) {
      // Damage probes need an unobstructed floor point, away from the monkey house roof.
      const home = def.id === 'monkey' ? { x: 0, z: 26, y: .7 } : { x: boss.transform.x, z: boss.transform.z, y: boss.transform.y };
      // Seven flamingos / zebras / monkeys share one body model per type: the first, the monkey leader and the lioness are the distinct cases.
      const slots = def.id === 'monkey' ? [0, def.count - 1] : def.id === 'lion' ? [0, 1] : [0];
      if (!slots.includes(boss.infected!.arenaBoss!.slot)) continue;
      const per: Record<string, number> = {};
      for (const weapon of WEAPONS) for (const range of [2, 8]) {
        // r31-flamingo: the bosses now have small HP; a big pool keeps every probe shot from killing the boss (a death opens gates/phases and changes the next probes).
        boss.health.max = boss.health.current = 1e6; boss.corpse = false;
        const pin = () => { for (const other of w.entities.iterate()) if (other !== boss && other.infected && other.id !== 1) { other.transform.x = home.x + 400; other.transform.z = home.z + 400; w.spatial.set(other.id, other.transform.x, other.transform.z); } boss.transform.x = home.x; boss.transform.z = home.z; boss.transform.y = home.y; boss.infected!.arenaBoss!.exposedUntil = 0; w.spatial.set(boss.id, home.x, home.z); boss.health.current = Math.max(1, boss.health.current); };
        const { damage, fired, noLine } = shoot(w, boss, weapon, range, pin);
        if (noLine) { failures.push(`${def.id}#${boss.infected!.arenaBoss!.slot} ${weapon} @${range} m: no clear firing line`); continue; }
        boss.health.max = def.id === 'monkey' && boss.infected!.arenaBoss!.slot === def.count - 1 ? def.hp * 2 : def.hp; boss.health.current = boss.health.max;
        if (range === 8) per[weapon] = damage;
        const rocketTooClose = weapon === 'weapon.rocket-launcher' && range < 5;
        const label = `${def.id}#${boss.infected!.arenaBoss!.slot} ${weapon} @${range} m`;
        if (rocketTooClose) { if (fired || damage > 0) failures.push(`${label}: rocket fired inside the minimum range`); }
        else if (damage <= 0) { failures.push(`${label}: no damage (fired=${fired})`); }
      }
      // r31-flamingo (PO 11-10): bosses scale to the L8 weapons (no rocket). Pistol column = weapon.pistol damage as the handgun stand-in.
      if (boss.infected!.arenaBoss!.slot === 0) {
        const hp = def.hp, hand = per['weapon.pistol'] ?? 0, shot = per['weapon.shotgun'] ?? 0, mg = per['weapon.army-mg'] ?? 0;
        const need = (cond: boolean, text: string) => { if (!cond) failures.push(`${def.id} hp ${hp}: ${text} (pistol ${hand}, shotgun ${shot}, mg ${mg})`); };
        if (def.id === 'flamingo' || def.id === 'monkey') { need(shot >= hp - 1, 'one shotgun blast must kill'); need(mg * 6 >= hp, 'a 6-bullet MG burst must kill'); need(hand * 4 >= hp, 'four handgun hits must kill'); }
        if (def.id === 'zebra') need(shot * 2 >= hp, 'two shotgun blasts must kill a zebra');
        if (def.id === 'lion') need(mg * 30 >= hp, 'a 30-round MG magazine must kill a lion');
        if (def.id === 'gorilla') need(mg * 60 >= hp, 'two 30-round MG magazines must kill the gorilla');
        if (def.id === 'elephant') need(mg * 30 < hp / 2, 'gunfire only chips the elephant (a magazine stays below half)');
      }
    }
  }
  expect(failures).toEqual([]);
  } finally { dispose(w); }
}
/** An ordinary infected takes damage from every firearm at 2 m and 8 m; the rocket refuses at 2 m. */
export async function checkOrdinaryDamage(): Promise<void> {
  const w = await loadLevel('L8', 1);
  try {
  const w = await loadLevel('L8', 1); 
  w.combat!.damage.god = true;
  const failures: string[] = [];
  for (const weapon of WEAPONS) for (const range of [2, 8]) {
    const id = w.spawnDummy('infected.walker', { x: 0, z: -4 }, { hp: 200 }), e = w.entities.get(id)!, home = { x: e.transform.x, z: e.transform.z };
    const { damage, fired } = shoot(w, e, weapon, range, () => { e.transform.x = home.x; e.transform.z = home.z; e.health.current = Math.max(1, e.health.current); });
    e.transform.x += 500; e.transform.z += 500;
    const label = `walker ${weapon} @${range} m`;
    if (weapon === 'weapon.rocket-launcher' && range < 5) { if (fired || damage > 0) failures.push(`${label}: rocket fired inside the minimum range`); }
    else if (damage <= 0) failures.push(`${label}: no damage (fired=${fired})`);
  }
  expect(failures).toEqual([]);
  } finally { dispose(w); }
}
/** Bosses stay damageable inside their attack and phase states (dive, kick, charge, roar, swipe, phase 2, roof). */
export async function checkBossStates(): Promise<void> {
  const w = await loadLevel('L8', 1);
  try {
  const w = await loadLevel('L8', 1); 
  const zoo = w.missions!.l8!;
  zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  const start = (zoo.bosses as unknown as { start: Start }).start.bind(zoo.bosses);
  const moves: Record<string, Array<[string, number, number, number]>> = {
    flamingo: [['flamingo.dive', 36, 15, 1.1]], zebra: [['zebra.kick', 36, 0, 2]],
    monkey: [['monkey.grab', 48, 10, .8], ['monkey.debris', 48, 0, 1.2]], lion: [['lion.roar', 36, 0, 8]],
    gorilla: [['gorilla.pound', 60, 0, 5], ['gorilla.roar', 60, 0, 5]], elephant: [['elephant.charge', 54, 44, 1.75], ['elephant.swipe', 42, 0, 5.5]],
  };
  const failures: string[] = [];
  for (const def of l8BossArenas) {
    const boss = turnArena(w, def.id)[0], arena = zoo.state.arenas.find(a => a.id === def.id)!;
    const home = { x: boss.transform.x, z: boss.transform.z, y: boss.transform.y };
    const pin = () => {
      for (const other of w.entities.iterate()) if (other !== boss && other.infected && other.id !== 1) { other.transform.x = home.x + 400; other.transform.z = home.z + 400; }
      boss.transform.x = home.x; boss.transform.z = home.z; boss.transform.y = home.y; boss.infected!.arenaBoss!.exposedUntil = 0; w.spatial.set(boss.id, home.x, home.z); boss.health.current = Math.max(1, boss.health.current);
    };
    const cases: Array<[string, () => void]> = [
      ...(moves[def.id] ?? []).map(([move, windup, range, radius]): [string, () => void] => [move, () => start(boss, move, windup, range, radius)]),
      ['phase-2', () => { arena.phase = 2; }], ['phase-1', () => { arena.phase = 1; }],
      ['roof', () => { boss.infected!.arenaBoss!.roof = true; boss.infected!.perched = true; }],
    ];
    for (const [name, apply] of cases) for (const weapon of ['weapon.pistol', 'weapon.army-mg']) for (const range of [2, 8]) {
      if (weapon.includes('rocket') && range < 5) continue;
      boss.health.current = boss.health.max; boss.infected!.specialAttack = undefined;
      boss.infected!.arenaBoss!.roof = false; boss.infected!.perched = false;
      apply();
      if (shoot(w, boss, weapon, range, pin).damage <= 0) failures.push(`${def.id} [${name}] ${weapon} @${range} m: no damage`);
    }
  }
  expect(failures).toEqual([]);
  } finally { dispose(w); }
}
/** The sanctuary wait cue and the opening "Protect the group!" marker (r24 pre-PROD QA, both P2). */
export async function checkL8Cues(): Promise<void> {
  const w = await loadLevel('L8', 1);
  try {
  const w = await loadLevel('L8', 1); 
  const mission = w.missions!, zoo = mission.l8!, advance = (n: number) => { for (let i = 0; i < n; i++) w.update(); };
  const step = () => mission.def.steps.find(s => s.id === 'sanctuary')!;
  advance(2);
  expect(l8SanctuaryResting(mission), 'far from the plaza the courier still follows Nadia').toBe(false);
  expect(objectiveText(mission, step().text)).toBe('Follow Nadia');
  missionControls(w).teleport(1, mission.def.anchors['central-plaza']); advance(2);
  expect(mission.state.states.breached).toBeFalsy();
  // r36-l8gates (QA P3 "Rest at the plaza objective flickers during Nadia's tour"): her route crosses the plaza ring; no rest cue while she leads.
  expect(l8SanctuaryResting(mission), 'no rest cue while Nadia still leads the tour').toBe(false);
  zoo.state.guideDone = 2; zoo.state.guideArrivedAt = w.tick;
  expect(l8SanctuaryResting(mission)).toBe(true);
  expect(objectiveText(mission, step().text)).toBe('Rest at the plaza with the group');
  // The calm ends at the latest after its 120 s cap.
  w.tick = zoo.state.startedAt + 120 * 60 - 1; advance(2);
  expect(mission.state.states.breached).toBe(true);
  expect(mission.state.steps.escape.status).toBe('active');
  expect(zoo.protecting()).toBe(true);
  expect(objectiveText(mission, 'x')).toBe('Protect the group!');
  expect(mission.state.marker, 'marker from the first tick of the step').toBe('central-plaza');
  expect(markerAnchor(mission)).not.toBeNull();
  // r33-l8route: the plaza hatches make the opening a real fight; this cue probe stands idle, so it needs protection to reach the end of the hold.
  w.combat!.damage.god = true;
  for (let i = 0; i < 4000 && zoo.protecting(); i++) w.update();
  expect(zoo.protecting()).toBe(false);
  expect(mission.state.marker).not.toBeNull();
  } finally { dispose(w); }
}
