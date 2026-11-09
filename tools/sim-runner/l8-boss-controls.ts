/** Controlled native checks complement the mortal arena runs; setup mutations never count as combat victories. */
import { OrthographicCamera } from 'three';
import { Vfx } from '../../src/render/vfx/Vfx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyInput } from '../../src/input/InputFrame';
import { barEligible } from '../../src/render/HealthBars';
import { l8BossArenas, type L8BossId } from '../../src/data/l8Bosses';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { loadLevel } from './levels';
import { provenance } from '../qa/accept/probe';
import { NavGrid } from '../../src/sim/ai/NavGrid';
import { PathProbe, physicalPathEntry } from '../qa/threat/observer';
const out = process.env.L8_BOSS_OUT ?? 'test-results/l8-boss-controls', tier = (process.env.L8_BOSS_TIER ?? 'low') as 'low' | 'high';
mkdirSync(out, { recursive: true });
const checks: { name: string; pass: boolean; value: unknown }[] = [], errors: string[] = [];
const check = (name: string, pass: boolean, value: unknown) => { checks.push({ name, pass, value }); console.log(JSON.stringify(checks.at(-1))); };
const step = (w: SimWorld, n = 1) => { for (let i = 0; i < n; i++) w.update(); };
async function fixture(id: L8BossId, nadiaAlive = true) {
  const w = await loadLevel('L8', 1808, undefined, 0, { quality: tier }), zoo = w.missions!.l8!;
  for (const other of zoo.state.arenas) if (other.id !== id) other.phase = 3;
  if (!nadiaAlive) { const keeper = w.entities.get(zoo.state.keeperId)!; keeper.health.current = 0; keeper.civilian!.state = 'finished'; }
  const arena = zoo.state.arenas.find(a => a.id === id)!, e = w.entities.get(arena.ids[0])!;
  const lines: string[] = []; w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') lines.push(e.id); });
  // Isolated lifecycle fixture: real infection timer, independent of the full-route tunnel-contact test.
  w.npcs!.civilians.outbreak!.infect(e, 1);
  for (let n = 0; n < 600 && (!e.infected || e.infectionRise); n++) step(w);
  if (!e.infected) throw Error(`${id} did not transform in the controlled fixture`);
  return { w, zoo, m: w.missions!, p: w.entities.get(1)!, arena, e, lines };
}
const hit = (w: SimWorld, e: EntitySnapshot, base: number, type: 'bullet' | 'melee' = 'bullet') => w.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: w.infected!.arenaAttackId(), actionId: type === 'melee' ? 'weapon.fire-axe' : 'weapon.handgun', origin: w.entities.get(1)!.transform, direction: { x: 1, z: 0 }, base, multiplier: 1, type, knockback: 0, stagger: 0 });
// Isolated weapon capability matrix: real selectors, repeated triggers, hit queries,
// projectiles and damage; courier protection keeps this separate from mortal completion.
for (const def of l8BossArenas) {
  const { w, zoo, m, p, arena, e } = await fixture(def.id);
  try {
    w.combat!.damage.god = true; m.state.states.breached = true; m.state.states['hale-keys'] = true; m.state.states['hale-fallen'] = true;
    zoo.state.breachedAt = w.tick || 1; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    arena.phase = 1; arena.nextAt = Number.MAX_SAFE_INTEGER;
    w.combat!.runner.loadout.collect('RIGHT', 'weapon.hunting-rifle', true);
    const shots = new Map<string, number>(), damage = new Map<string, number>(), reactions = new Map<string, number>();
    w.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.sourceId === 1) shots.set(event.actionId, (shots.get(event.actionId) ?? 0) + 1); });
    w.events.on('combat.hit', event => {
      if (event.type !== 'combat.hit' || event.sourceId !== 1 || event.targetId !== e.id || event.amount <= 0) return;
      damage.set(event.actionId, (damage.get(event.actionId) ?? 0) + event.amount);

    });
    for (const weapon of ['weapon.shotgun', 'weapon.army-mg', 'weapon.hunting-rifle', 'weapon.rocket-launcher']) {
      const distance = weapon === 'weapon.rocket-launcher' ? 12 : 6;
      const offset = [{ x: 0, z: distance }, { x: distance, z: 0 }, { x: 0, z: -distance }, { x: -distance, z: 0 }].find(d => w.solids.clear({ x: e.transform.x + d.x, y: .7, z: e.transform.z + d.z }, .35, p.id, false) && w.combat!.query.visible({ x: e.transform.x + d.x, z: e.transform.z + d.z }, e.transform));
      if (!offset) throw Error(`${def.id}: no clear weapon fixture origin`);
      w.solids.relocate(p, { x: e.transform.x + offset.x, y: .7, z: e.transform.z + offset.z }, 'qa.weapon-origin', 1);
      const slot = w.combat!.runner.loadout.activeEntries().find(entry => entry.id === weapon)!;
      for (let n = 0; n < 600 && ((shots.get(weapon) ?? 0) < 2 || !(damage.get(weapon)! > 0)); n++) {
        const f = emptyInput(), dx = e.transform.x - p.transform.x, dz = e.transform.z - p.transform.z, length = Math.hypot(dx, dz) || 1;
        f.selectedSlot = slot; f.aim = { x: dx / length, z: dz / length }; f.aimPoint = { x: e.transform.x, z: e.transform.z }; f.aimSource = 'pointer'; f.strafe = true; f[slot.side === 'LEFT' ? 'left' : 'right'].held = true;
        f.move = length > 8 ? { x: dx / length, z: dz / length } : length < (weapon === 'weapon.rocket-launcher' ? 8 : 4) ? { x: -dx / length, z: -dz / length } : f.move;
        w.applyInput(f, 'keyboard'); step(w);
        if ((damage.get(weapon) ?? 0) > 0 && (e.combat!.reaction?.until ?? 0) > w.tick) reactions.set(weapon, (reactions.get(weapon) ?? 0) + 1);
      }
      const value = { boss: def.id, weapon, shots: shots.get(weapon) ?? 0, damage: damage.get(weapon) ?? 0, reactions: reactions.get(weapon) ?? 0, hp: e.health.current };
      check(`${def.id} loses health and reacts to repeated ${weapon}`, value.shots >= 2 && value.damage > 0 && value.reactions > 0, value);
      // Allow an in-flight second rocket to resolve before the next selector.
      w.applyInput(emptyInput(), 'keyboard'); step(w, 45);
    }
  } catch (error) { errors.push(`weapon matrix ${def.id}: ${String(error)}`); }
  finally { w.dispose(); }
}
try {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1808);
  try {
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 1.6, z: 0 }))!;
    const nav = new NavGrid({ width: 20, depth: 20 }, [{ x: 0, z: 0, y: 1, halfX: 2, halfZ: 2, halfY: 1 }]);
    w.solids.setBarrier('qa.diagonal', { x: 0, z: 0, y: 1, halfX: 2.5, halfZ: .2, halfY: 1, yaw: Math.PI / 4 });
    const entry = physicalPathEntry(w, e, nav), radius = e.combat!.radius;
    const bounded = !!entry && new PathProbe().query(nav, e, { x: 5, z: 0 }, 2.5, [entry]);
    for (const [i, wall] of [{ x: .8, z: 0, halfX: .1, halfZ: 1 }, { x: 2.4, z: 0, halfX: .1, halfZ: 1 }, { x: 1.6, z: -.8, halfX: 1, halfZ: .1 }, { x: 1.6, z: .8, halfX: 1, halfZ: .1 }].entries()) w.solids.setBarrier(`qa.closed-${i}`, { ...wall, y: 1, halfY: 1 });
    const rejected = physicalPathEntry(w, e, nav) === undefined;
    check('bounded path entry uses the actual body sweep and rejects a closed physical pocket', bounded && rejected, { entry, radius, unchangedStretch: 2.5, bounded, closedPocketRejected: rejected });
  } finally { w.dispose(); }
} catch (error) { errors.push(`physical path prefix: ${String(error)}`); }
try {
  const { w, m, zoo, p, arena, e } = await fixture('gorilla');
  try {
    const healthy = w.entities.get(zoo.state.animals[0])!;
    check('healthy animal has no enemy bar', !barEligible(healthy, healthy.transform, true), { id: healthy.id, infected: !!healthy.infected });
    const def = l8BossArenas.find(a => a.id === 'gorilla')!;
    w.solids.relocate(p, { x: 60, z: -15, y: .7 }, 'qa.arena.control-entry', 2);
    m.state.states.breached = true; zoo.state.breachedAt = w.tick; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    step(w);
    check('engagement sets arena-entry checkpoint and health bar', m.state.checkpoint === 'arena-gorilla' && barEligible(e, p.transform, true), { checkpoint: m.state.checkpoint, arenaPhase: arena.phase, bar: barEligible(e, p.transform, true) });
    const specialPickups = w.entities.values().filter(e => e.pickup && 'arenaAmmo' in e.pickup);
    check('arena uses the campaign launcher with no arena ammunition pickup', specialPickups.length === 0 && w.combat!.runner.loadout.activeEntries().some(x => x.id === 'weapon.rocket-launcher'), { specialPickups: specialPickups.length, rack: w.combat!.runner.loadout.activeEntries().map(x => x.id) });
    const pillar = w.destruction!.objects.find(o => o.id.includes('l8-gorilla-pillar-0'))!;
    const beforeHP = [...pillar.state.hp];
    w.destruction!.impact(pillar.id, 'boss.gorilla.smash', 1000);
    check('pillar uses the real destruction owner', pillar.state.collapsed && pillar.state.hp.every(hp => hp === 0), { id: pillar.id, beforeHP, hp: pillar.state.hp, collapsed: pillar.state.collapsed });
    arena.phase = 2; e.health.current /= 3;
    const beforeDeaths = m.state.stats.deaths;
    w.combat!.damage.apply({ sourceId: e.id, targetId: 1, attackId: w.infected!.arenaAttackId(), actionId: 'infected.gorilla.pound', origin: e.transform, direction: { x: 1, z: 0 }, base: 100000, multiplier: 1, type: 'status', knockback: 0, stagger: 0 });
    for (let n = 0; n < 600 && (m.state.stats.deaths === beforeDeaths || p.health.current <= 0); n++) step(w);
    const restored = zoo.state.arenas.find(a => a.id === 'gorilla')!, restoredBoss = w.entities.get(restored.ids[0])!;
    const restoredPillar = w.destruction!.objects.find(o => o.id === pillar.id)!;
    check('mortal retry restores entry, phase, boss HP and cover without an ammo gate', m.state.stats.deaths === beforeDeaths + 1 && Math.hypot(p.transform.x - def.entry.x, p.transform.z - def.entry.z) <= 1.5 && restored.phase === 1 && restoredBoss.health.current === restoredBoss.health.max && !restoredPillar.state.collapsed && !w.entities.values().some(e => e.pickup && 'arenaAmmo' in e.pickup),
      { deaths: m.state.stats.deaths - beforeDeaths, at: p.transform, phase: restored.phase, hp: restoredBoss.health, pillarHP: restoredPillar.state.hp });
    // Ordinary firearm hit during the windup interrupts the chest-beat; its recovery must be more vulnerable than its prowl.
    w.solids.relocate(restoredBoss, { x: 60, z: -22, y: .7 }, 'qa.arena.roar-source', 2);
    w.solids.relocate(p, { x: 60, z: -16, y: .7 }, 'qa.arena.roar-target', 1);
    delete restoredBoss.infected!.specialAttack; restoredBoss.infected!.arenaBoss!.readyAt = 0; restoredBoss.infected!.arenaBoss!.exposedUntil = 0;
    restoredBoss.combat!.staggerUntil = 0; restored.nextAt = w.tick; restored.cycle = 0;
    const body = hit(w, restoredBoss, 14); step(w, 2);
    const attack = () => w.entities.get(restoredBoss.id)!.infected!.specialAttack;
    const a = attack(), windup = a?.move === 'gorilla.roar' && a.stage === 'telegraph';
    const exposed = hit(w, restoredBoss, 14); step(w);
    check('chest beat can be hit during its full one-second cue and countered into recovery', windup && attack()?.stage === 'recovery' && exposed > body && restored.counters > 0,
      { windup, body, exposed, move: restoredBoss.infected!.specialAttack, counters: restored.counters });
    hit(w, restoredBoss, 1e9);
    check('ordinary weapons finish an arena boss permanently', restoredBoss.health.current === 0 && restoredBoss.infected!.recoverAt < 0, { hp: restoredBoss.health.current, recoverAt: restoredBoss.infected!.recoverAt });
  } finally { w.dispose(); }
} catch (error) { errors.push(`checkpoint/punish: ${String(error)}`); }
try {
  const { w, arena, p } = await fixture('monkey');
  try {
    w.combat!.damage.god = true; // Motion/route control only; never counted as a mortal combat victory.
    arena.phase = 1; arena.nextAt = Number.MAX_SAFE_INTEGER;
    const climber = w.entities.get(arena.ids[2])!;
    w.npcs!.civilians.outbreak!.infect(climber, 1);
    w.solids.relocate(p, { x: -2, z: 14, y: .7 }, 'qa.roof.inside', 2);
    for (let n = 0; n < 600 && (!climber.infected?.arenaBoss?.roof || climber.infected.arenaBoss.traversal); n++) step(w);
    const perched = !!climber.infected?.arenaBoss?.roof && climber.transform.y > 4;
    const guarded = hit(w, climber, 14, 'melee') === 0;
    w.solids.relocate(p, { x: 12, z: 6, y: .7 }, 'qa.roof.outside', 2); step(w);
    const descent = structuredClone(climber.infected?.arenaBoss?.traversal);
    let previous = { ...climber.transform }, maxStep = 0;
    for (let n = 0; n < 90; n++) {
      step(w); maxStep = Math.max(maxStep, Math.hypot(climber.transform.x - previous.x, climber.transform.y - previous.y, climber.transform.z - previous.z)); previous = { ...climber.transform };
    }
    const grounded = !climber.infected?.arenaBoss?.roof && !climber.infected?.arenaBoss?.traversal && climber.transform.y < 1;
    check('roof monkey keeps height guards and physically descends when the courier leaves', perched && guarded && descent?.roof === false && grounded && maxStep < .3, { perched, guarded, descent, grounded, maxStep, at: climber.transform });
  } finally { w.dispose(); }
} catch (error) { errors.push(`roof route: ${String(error)}`); }
try {
  const { w, arena, e, p, zoo } = await fixture('monkey');
  try {
    arena.phase = 1; arena.nextAt = w.tick + 10000; e.infected!.arenaBoss!.readyAt = w.tick + 10000;
    w.solids.relocate(e, { x: p.transform.x + 1.2, z: p.transform.z, y: .7 }, 'qa.arena.grab-source', 1);
    const loadout = w.combat!.runner.loadout, axe = loadout.activeEntries().find(x => x.id === 'weapon.fire-axe')!, gun = loadout.activeEntries().find(x => x.id === 'weapon.army-mg')!;
    loadout.state[axe.side].index = axe.index; loadout.state[gun.side].index = gun.index; loadout.state.selectedSide = gun.side;
    let gripDamage = 0;
    w.events.on('combat.hit', event => { if (event.type === 'combat.hit' && event.sourceId === e.id && event.targetId === 1 && event.actionId === 'infected.monkey.grab') gripDamage += event.amount; });
    e.infected!.grabUntil = w.tick + 120; e.infected!.grabHits = 0; e.infected!.arenaBoss!.shakeHits = 0;
    w.applyInput({ ...emptyInput(), selectedSlot: { side: axe.side, index: axe.index } }, 'keyboard'); step(w, 60);
    check('a close monkey grab continues real contact damage until escaped', gripDamage > 0, { gripDamage, hp: p.health.current });
    check('grab blocks weapon selection for two seconds', loadout.state.selectedSide === gun.side && zoo.bosses.swapBlocked(), { selected: loadout.state.selectedSide, gunSide: gun.side, blocked: zoo.bosses.swapBlocked(), remaining: e.infected!.grabUntil - w.tick });
    w.applyInput({ ...emptyInput(), aim: { x: 1, z: 0 }, aimSource: 'keyboard', left: { down: true, held: true, up: false } }, 'keyboard');
    step(w, 45);
    check('a real melee hit shakes off the monkey and opens recovery', e.infected!.grabUntil <= w.tick && arena.counters > 0, { grabUntil: e.infected!.grabUntil, tick: w.tick, counters: arena.counters, hp: e.health.current });
    e.infected!.grabUntil = w.tick + 120; e.infected!.arenaBoss!.readyAt = w.tick + 10000; e.infected!.arenaBoss!.shakeHits = 0; delete e.infected!.specialAttack;
    w.applyInput(emptyInput(), 'keyboard'); step(w, 121);
    w.applyInput({ ...emptyInput(), selectedSlot: { side: gun.side, index: gun.index } }, 'keyboard'); step(w);
    check('weapon selection returns at grab expiry', !zoo.bosses.swapBlocked() && loadout.state.selectedSide === gun.side, { blocked: zoo.bosses.swapBlocked(), selected: loadout.state.selectedSide, expected: gun.side });
  } finally { w.dispose(); }
} catch (error) { errors.push(`monkey grab: ${String(error)}`); }

try {
  const { w, zoo, p, arena, e } = await fixture('elephant');
  try {
    w.missions!.state.states.breached = true; zoo.state.breachedAt = w.tick; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    w.solids.relocate(e, { x: 100, z: 80, y: .7 }, 'qa.elephant.lure-source', 2);
    w.solids.relocate(p, { x: 110, z: 80, y: .7 }, 'qa.elephant.lure-target', 2);
    arena.phase = 1; arena.nextAt = w.tick + 30; arena.cycle = 0;
    const charges: unknown[] = [];
    w.events.on('infected.special', event => { if (event.type === 'infected.special' && event.sourceId === e.id && event.move === 'elephant.charge' && event.stage === 'recovery') charges.push({ tick: w.tick, a: structuredClone(e.infected!.specialAttack), boss: { ...e.transform }, courier: { ...p.transform }, neighbors: w.entities.values().filter(v => v.id !== e.id && v.health.current > 0 && Math.hypot(v.transform.x-e.transform.x,v.transform.z-e.transform.z)<6).map(v=>({id:v.id,role:v.archetype,at:{...v.transform},radius:v.combat?.radius})), staticAhead: w.solids.sweep(e, { x: e.infected!.specialAttack!.area.dx, z: e.infected!.specialAttack!.area.dz }, 14 / 60, e.combat!.radius, false, false) }); });
    const contacts: { barrier?: string; [key: string]: unknown }[] = []; let previous = 0;
    for (let n = 0; n < 30 * 60 && arena.wallHits === 0 && e.health.current > 0 && p.health.current > 0; n++) {
      const f = emptyInput();
      // Read the live cue, sidestep the charge lane, and hold the lure position between attacks.
      const attack = e.infected!.specialAttack;
      if (attack && (attack.stage === 'telegraph' || attack.stage === 'active')) {
        if (attack.move === 'elephant.charge') {
          const dx = p.transform.x - attack.area.x, dz = p.transform.z - attack.area.z;
          const sign = dx * -attack.area.dz + dz * attack.area.dx >= 0 ? 1 : -1;
          const first = { x: -attack.area.dz * sign, z: attack.area.dx * sign }, other = { x: -first.x, z: -first.z };
          f.move = w.solids.sweep(p, first, 3) >= w.solids.sweep(p, other, 3) ? first : other;
        } else if (attack.move === 'elephant.swipe') {
          const dx = p.transform.x - attack.area.x, dz = p.transform.z - attack.area.z, d = Math.hypot(dx, dz) || 1;
          f.move = { x: dx / d, z: dz / d };
        }
      }
      if (p.transform.x + f.move.x * 2 < 106 || p.transform.x + f.move.x * 2 > 114) f.move.x = 0;
      if (p.transform.z + f.move.z * 2 < 76 || p.transform.z + f.move.z * 2 > 88) f.move.z = 0;
      w.applyInput(f, 'keyboard'); step(w);
      if (arena.wallHits > previous) { previous = arena.wallHits; contacts.push({ tick: w.tick, hits: previous, barrier: arena.wallContacts?.at(-1), boss: { ...e.transform }, courier: { ...p.transform }, hp: e.health.current }); }
    }
    for (let expected = 2; expected <= 3; expected++) {
      // Independent lure setup; retain the actual wall-hit ledger and HP.
      w.solids.relocate(e, { x: 100, z: 80, y: .7 }, 'qa.elephant.repeat-source', 2);
      w.solids.relocate(p, { x: 110, z: 80, y: .7 }, 'qa.elephant.repeat-lure', 2, false);
      w.previousPlayer = { ...p.transform }; w.player!.locomotion.reset();
      delete e.infected!.specialAttack; e.infected!.arenaBoss!.readyAt = 0; arena.nextAt = w.tick + 30;
      for (let n = 0; n < 300 && arena.wallHits < expected && e.health.current > 0; n++) {
        const f = emptyInput(), a = w.entities.get(e.id)!.infected!.specialAttack;
        if (a && ['telegraph', 'active'].includes(a.stage) && p.transform.z < 86) f.move = { x: 0, z: 1 };
        w.applyInput(f, 'keyboard'); step(w);
        if (arena.wallHits > previous) { previous = arena.wallHits; contacts.push({ tick: w.tick, hits: previous, barrier: arena.wallContacts?.at(-1), hp: e.health.current }); }
      }
    }
    check('three actual sidestepped wall collisions permanently finish the elephant (independent lure setup)', arena.wallHits === 3 && e.health.current === 0 && e.infected!.recoverAt < 0 && contacts.every(c => !!c.barrier && !c.barrier.includes('bush')), { contacts, wallHits: arena.wallHits, hp: e.health.current, courierHP: p.health.current, charges });
  } finally { w.dispose(); }
} catch (error) { errors.push(`elephant wall tactic: ${String(error)}`); }


try {
  const { w, zoo, p, arena, e } = await fixture('gorilla');
  try {
    w.missions!.state.states.breached = true; zoo.state.breachedAt = w.tick; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
    w.solids.relocate(e, { x: 60, z: -22, y: .7 }, 'qa.gorilla.missile-source', 2);
    w.solids.relocate(p, { x: 60, z: -10, y: .7 }, 'qa.gorilla.missile-target', 2);
    const payloadId = w.infected!.spawn('infected.runner', { x: 58.7, z: -22 }, { state: 'chase' });
    const payload = w.entities.get(payloadId)!;
    arena.phase = 1; arena.cycle = 1; arena.nextAt = w.tick;
    const camera = new OrthographicCamera(), fx = new Vfx(w, { camera: () => camera, flash: () => {}, detach: () => {}, blood: () => {}, clearGore: () => {}, shake: () => {} });
    const marks: {x:number;z:number;aspect?:number;shape:number}[] = [], spawn = fx.telegraphs.spawn.bind(fx.telegraphs);
    fx.telegraphs.spawn = (...args) => { marks.push({x:args[2],z:args[4],aspect:args[12],shape:args[9]}); return spawn(...args); };
    let lifted = false, flight = false, landed = false, rolling = false, landingDistance = 0, markedLanding = false;

    for (let n = 0; n < 500 && !landed; n++) {
      step(w); const a = e.infected!.specialAttack;
      if (a?.projectile?.objectId === payloadId) {
        lifted ||= a.stage === 'telegraph' && payload.infected!.thrownBy === e.id;
        const mark = marks.at(-1), projectile = a.projectile;
        if (mark && projectile && mark.aspect === 1 && mark.shape === 1) markedLanding ||= Math.hypot(mark.x-projectile.x-projectile.dx*projectile.range,mark.z-projectile.z-projectile.dz*projectile.range) < .01;
        flight ||= a.stage === 'active' && payload.transform.y > 1;
        if (flight && payload.infected!.thrownBy === undefined) {
          landed = payload.health.current > 0; rolling = payload.combat!.staggerUntil - w.tick === 36 && payload.combat!.reaction?.heavy === true && payload.combat!.reaction.until - w.tick === 36;
          landingDistance = Math.hypot(payload.transform.x - a.target.x, payload.transform.z - a.target.z);
        }
      }
    }
    check('arena throw ground mark uses the actual short landing endpoint', markedLanding, { marks, markedLanding });
    fx.dispose();
    check('gorilla lifts a real living infected, lands it nearby and gives it a 0.6s roll', lifted && flight && landed && rolling && landingDistance >= 1 && landingDistance <= 3, { payloadId, lifted, flight, landed, rolling, landingDistance, hp: payload.health.current, at: payload.transform });
  } finally { w.dispose(); }
} catch (error) { errors.push(`gorilla living missile: ${String(error)}`); }

for (const alive of [true, false]) {
  try {
    const { w, e, lines, zoo, arena } = await fixture('elephant', alive);
    try {
      arena.phase = 1; zoo.update(); hit(w, e, 1e9); step(w, 2);
      check(`elephant dialogue continuity (Nadia ${alive ? 'alive' : 'dead'})`, lines.includes('L8.nadia-elephant') === alive && lines.filter(id => id === 'L8.courier-elephant').length === 1 && e.health.current === 0, { lines, hp: e.health.current, nadiaAlive: alive });
    } finally { w.dispose(); }
  } catch (error) { errors.push(`dialogue ${alive}: ${String(error)}`); }
}
writeFileSync(`${out}/${tier}-controls.json`, JSON.stringify({ ...provenance(process.env.L8_BOSS_REVISION ?? 'working-tree'), tier, method: 'Controlled native lifecycle, mortal checkpoint, input, damage, bar and dialogue checks; setup mutations are explicit and do not certify arena combat completion.', checks, errors }, null, 2) + '\n');
if (errors.length || checks.some(c => !c.pass)) { console.error(JSON.stringify({ errors, failed: checks.filter(c => !c.pass).map(c => c.name) })); process.exitCode = 1; }
