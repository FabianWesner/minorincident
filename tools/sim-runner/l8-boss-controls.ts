/** Controlled native checks complement the mortal arena runs; setup mutations never count as combat victories. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Walker } from '../../src/debug/bot/Walker';
import { emptyInput } from '../../src/input/InputFrame';
import { barEligible } from '../../src/render/HealthBars';
import { l8BossArenas, type L8BossId } from '../../src/data/l8Bosses';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { loadLevel } from './levels';
import { provenance } from '../qa/accept/probe';
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
    const rackCount = w.combat!.runner.loadout.activeEntries().length;
    const pickup = w.entities.values().filter(e => e.pickup && 'arenaAmmo' in e.pickup && e.pickup.arenaAmmo === 'gorilla');
    check('one rocket pickup is present at entry', pickup.length === 1, pickup.map(e => ({ id: e.id, at: e.transform })));
    if (pickup[0]) w.solids.relocate(p, { ...pickup[0].transform, y: .7 }, 'qa.arena.ammo-contact', 1);
    step(w);
    const one = zoo.bosses.spendRocket(), second = zoo.bosses.spendRocket();
    check('pickup grants one rocket without changing the campaign rack', one && !second && w.combat!.runner.loadout.activeEntries().length === rackCount, { one, second, rackCount, after: w.combat!.runner.loadout.activeEntries().length, stock: arena.rocket });
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
    const restoredPickups = w.entities.values().filter(e => e.pickup && 'arenaAmmo' in e.pickup && e.pickup.arenaAmmo === 'gorilla').length;
    check('mortal retry restores entry, phase, boss HP, cover and rocket pickup', m.state.stats.deaths === beforeDeaths + 1 && Math.hypot(p.transform.x - def.entry.x, p.transform.z - def.entry.z) <= 1.5 && restored.phase === 1 && restoredBoss.health.current === restoredBoss.health.max && !restoredPillar.state.collapsed && restored.rocket + restoredPickups === 1,
      { deaths: m.state.stats.deaths - beforeDeaths, at: p.transform, phase: restored.phase, hp: restoredBoss.health, pillarHP: restoredPillar.state.hp, stock: restored.rocket, pickups: w.entities.values().filter(e => e.pickup && 'arenaAmmo' in e.pickup && e.pickup.arenaAmmo === 'gorilla').length });
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
  const { w, arena, e, p, zoo } = await fixture('monkey');
  try {
    arena.phase = 1; arena.nextAt = w.tick + 10000; e.infected!.arenaBoss!.readyAt = w.tick + 10000;
    w.solids.relocate(e, { x: p.transform.x + 1.2, z: p.transform.z, y: .7 }, 'qa.arena.grab-source', 1);
    const loadout = w.combat!.runner.loadout, axe = loadout.activeEntries().find(x => x.id === 'weapon.fire-axe')!, gun = loadout.activeEntries().find(x => x.id === 'weapon.army-mg')!;
    loadout.state[axe.side].index = axe.index; loadout.state[gun.side].index = gun.index; loadout.state.selectedSide = gun.side;
    e.infected!.grabUntil = w.tick + 120; e.infected!.grabHits = 0; e.infected!.arenaBoss!.shakeHits = 0;
    w.applyInput({ ...emptyInput(), selectedSlot: { side: axe.side, index: axe.index } }, 'keyboard'); step(w, 60);
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
    w.solids.relocate(e, { x: -60, z: 25, y: .7 }, 'qa.elephant.lure-source', 2);
    w.solids.relocate(p, { x: -44, z: 25, y: .7 }, 'qa.elephant.lure-target', 2);
    arena.phase = 1; arena.nextAt = w.tick + 30; arena.cycle = 0;
    const walker = new Walker(), contacts: unknown[] = []; let previous = 0, side = 1;
    for (let n = 0; n < 100 * 60 && e.health.current > 0 && p.health.current > 0; n++) {
      const a = e.infected!.specialAttack, f = emptyInput();
      if (a?.move === 'elephant.charge' && a.stage !== 'recovery') {
        const direction = { x: -a.area.dz, z: a.area.dx };
        const other = { x: -direction.x, z: -direction.z };
        f.move = w.solids.sweep(p, direction, 4) >= w.solids.sweep(p, other, 4) ? direction : other;
      } else {
        const x = side === 1 ? -44 : -76, z = Math.abs(p.transform.x - x) > 3 ? 17 : 25;
        f.move = walker.step(w, { x, z }, 1, `lure-${side}-${z}`) ?? f.move;
      }
      w.applyInput(f, 'keyboard'); step(w);
      if (arena.wallHits > previous) { previous = arena.wallHits; side = e.transform.x < -60 ? 1 : -1; contacts.push({ tick: w.tick, hits: previous, boss: { ...e.transform }, courier: { ...p.transform }, hp: e.health.current }); }
    }
    check('three real sidestepped wall charges kill without firing', arena.wallHits === 3 && e.health.current === 0, { contacts, wallHits: arena.wallHits, hp: e.health.current, courierHP: p.health.current });
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
    let lifted = false, flight = false, landed = false, rolling = false, landingDistance = 0;
    for (let n = 0; n < 500 && !landed; n++) {
      step(w); const a = e.infected!.specialAttack;
      if (a?.projectile?.objectId === payloadId) {
        lifted ||= a.stage === 'telegraph' && payload.infected!.thrownBy === e.id;
        flight ||= a.stage === 'active' && payload.transform.y > 1;
        if (flight && payload.infected!.thrownBy === undefined) {
          landed = payload.health.current > 0; rolling = payload.combat!.staggerUntil - w.tick === 36;
          landingDistance = Math.hypot(payload.transform.x - a.target.x, payload.transform.z - a.target.z);
        }
      }
    }
    check('gorilla lifts a real living infected, lands it nearby and gives it a 0.6s roll', lifted && flight && landed && rolling && landingDistance >= 1 && landingDistance <= 3, { payloadId, lifted, flight, landed, rolling, landingDistance, hp: payload.health.current, at: payload.transform });
  } finally { w.dispose(); }
} catch (error) { errors.push(`gorilla living missile: ${String(error)}`); }

for (const alive of [true, false]) {
  try {
    const { w, e, lines } = await fixture('elephant', alive);
    try {
      hit(w, e, 1e9); step(w, 2);
      check(`elephant dialogue continuity (Nadia ${alive ? 'alive' : 'dead'})`, lines.includes('L8.nadia-elephant') === alive && lines.filter(id => id === 'L8.courier-elephant').length === 1 && e.health.current === 0, { lines, hp: e.health.current, nadiaAlive: alive });
    } finally { w.dispose(); }
  } catch (error) { errors.push(`dialogue ${alive}: ${String(error)}`); }
}
writeFileSync(`${out}/${tier}-controls.json`, JSON.stringify({ ...provenance(process.env.L8_BOSS_REVISION ?? 'working-tree'), tier, method: 'Controlled native lifecycle, mortal checkpoint, input, damage, bar and dialogue checks; setup mutations are explicit and do not certify arena combat completion.', checks, errors }, null, 2) + '\n');
if (errors.length || checks.some(c => !c.pass)) { console.error(JSON.stringify({ errors, failed: checks.filter(c => !c.pass).map(c => c.name) })); process.exitCode = 1; }
