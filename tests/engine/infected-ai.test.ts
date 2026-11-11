// Infected AI core: the shared state machine (idle → chase → attack → down/dead), perception, telegraphs and body
// separation drive every enemy role in every level.
import { afterEach, expect, test } from 'vitest';
import { action } from '../../src/data/actions/catalog';
import { animalInfected, humanInfected, infectedDefinitions, infectedRecovery, INFECTED_TOUGHNESS, validateInfected, infectedSpecialMoves } from '../../src/data/infected';
import { infectedContactDistance, meleeRing } from '../../src/sim/ai/CharacterSeparation';
import type { DamageEvent } from '../../src/sim/combat/Damage';
import type { CoverWall } from '../../src/sim/combat/HitQuery';
import type { EntitySnapshot, GameEvent } from '../../src/sim/world/types';
import { clickable } from '../../src/input/ClickPick';
import { l1v2 } from '../../src/data/l1v2';
import { megaAlpha } from '../../src/data/megaAlpha';
import { alphaMixFor, alphaTypeFor, alphaTypes } from '../../src/data/alphaTypes';
import { l3 } from '../../src/data/l3';
import { l6HatchAlphas } from '../../src/data/l6';
import { PropSystem } from '../../src/sim/interact/PropSystem';
import { damageAmount } from '../../src/sim/combat/Damage';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { followFrustum, loadL3 } from '../../tools/sim-runner/l3Bots';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(seed = 1, god = true) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', seed); w.combat!.damage.god = god; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const spawn = (w: SimWorld, role: string, x: number, z = 0, state: 'chase' | 'idle' = 'chase') => w.entities.get(w.infected!.spawn(`infected.${role}`, { x, z }, { state }))!;
function hit(w: SimWorld, e: EntitySnapshot, type: DamageEvent['type'] = 'melee', base = 999, origin = { x: 0, z: 0 }): number {
  return w.combat!.damage.apply({ attackId: 1, actionId: type === 'explosive' ? 'weapon.grenade' : 'weapon.bat', sourceId: 1, targetId: e.id, origin, direction: { x: 1, z: 0 }, base, multiplier: 1, type, knockback: 0, stagger: 0 });
}
const [lowS, highS] = infectedRecovery.downS;

async function alphaTypeContracts() {
  const firstWorld = worlds.length;
  try {
    expect(alphaTypeFor('L1', 18)).toBe('brute'); expect(alphaTypeFor('L2', 18)).toBe('brute');
    expect(alphaTypeFor('L5', 92)).not.toBe(alphaTypeFor('L5', 99));
    expect([75, 76, 137, 173].map(id => alphaTypeFor('L7', id))).toEqual(expect.arrayContaining(['brute', 'thrower', 'screamer']));
    // r42: the authored route Alphas read the shared mix (L7 slots include the Screamer; L3 data and L6 hatch fronts use mix types).
    expect(alphaMixFor('L7')).toEqual(expect.arrayContaining(['brute', 'thrower', 'screamer']));
    for (const a of l3.density.alphas) expect(alphaMixFor('L3')).toContain(a.type);
    for (const type of Object.values(l6HatchAlphas)) expect(alphaMixFor('L6')).toContain(type);
    for (const level of ['L3', 'L4', 'L5', 'L6', 'L7', 'L9', 'L10']) {
      const present = new Set(Array.from({ length: 80 }, (_, id) => alphaTypeFor(level, id)));
      expect(present.size, level).toBeGreaterThan(1);
    }
    expect(alphaTypes.brute.moves).toEqual(expect.arrayContaining(['alpha.charge', 'alpha.ground-slam', 'alpha.grab-human']));
    expect(alphaTypes.thrower.moves).toEqual(expect.arrayContaining(['alpha.grab-throw', 'alpha.living-missile', 'alpha.barrage']));
    expect(alphaTypes.screamer.moves).toContain('alpha.roar'); expect(alphaTypes.leaper.moves).toContain('alpha.pounce');
    expect(alphaTypes.armoured.moves).toContain('alpha.shield-bash');
    for (const [type, definition] of Object.entries(alphaTypes)) for (const move of definition.moves) {
      const moveWorld = await arena(), alpha = moveWorld.entities.get(moveWorld.infected!.spawn('infected.alpha', { x: 8, z: 0 }, { alphaType: type as keyof typeof alphaTypes, state: 'chase' }))!;
      const player = moveWorld.entities.get(1)!;
      Object.assign(player.survivor!.velocity, { x: 3, z: 1.5 });
      const target = { id: 1, x: player.transform.x, z: player.transform.z }, area = { x: 8, z: 0, radius: 2, dx: -1, dz: 0 };
      expect(moveWorld.infected!.startSpecial(alpha.id, move, target, area), `${type}.${move}`).toBe(true);
      const locked = { id: 1, x: target.x + 3 * infectedSpecialMoves[move].windup / 60, z: target.z + 1.5 * infectedSpecialMoves[move].windup / 60 };
      expect(alpha.infected!.specialAttack!.target, `${type}.${move}: predicts the moving target`).toEqual(locked);
      target.x += 10; player.survivor!.velocity.x = -3;
      expect(alpha.infected!.specialAttack!.target, `${type}.${move}: target stays locked`).toEqual(locked);
      if (move === 'alpha.roar' || move === 'alpha.grab-human') expect(alpha.infected!.specialAttack!.area.radius).toBe(move === 'alpha.roar' ? 8 : 2.5);
      expect(moveWorld.infected!.startSpecial(alpha.id, move, target, area), `${type}.${move}: overlap`).toBe(false);
      expect(moveWorld.events.events().some(event => event.type === 'telegraph' && event.sourceId === alpha.id && event.special === move), `${type}.${move}`).toBe(true);
      moveWorld.dispose(); worlds.splice(worlds.indexOf(moveWorld), 1);
    }
    // Each move resolves a real effect after its tell, then exposes a punish/cooldown window.
    for (const [type, definition] of Object.entries(alphaTypes)) for (const move of definition.moves) {
      const w = await arena(1, false), ai = w.infected!, player = w.entities.get(1)!;
      player.health.current = player.health.max = 1000;
      const x = move === 'alpha.ground-slam' ? 3.5 : move === 'alpha.grab-human' || move === 'alpha.shield-bash' ? 1.8 : move === 'alpha.roar' ? 4 : move === 'alpha.barrage' ? 7 : 10;
      const alpha = w.entities.get(ai.spawn('infected.alpha', { x, z: 0 }, { alphaType: type as keyof typeof alphaTypes, state: 'chase' }))!;
      const addProp = (i: number) => {
        w.props ??= new PropSystem(w);
        return w.props.spawn({ id: `alpha-debris-${i}`, assetId: 'prop.traffic-cone', position: [x + .8, 0, i * .55 - .55], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [x, 0, -1], max: [x + 1, 1, 1] } });
      };
      let missile: EntitySnapshot | undefined;
      if (move === 'alpha.grab-throw') {
        const id = w.spawnDummy('corpse.fixture', { x: x + .8, z: 0 });
        missile = w.entities.get(id)!; missile.health.current = 0; missile.corpse = true;
      }
      if (move === 'alpha.living-missile') missile = spawn(w, 'runner', x + .8, 0, 'idle');
      if (move === 'alpha.barrage') for (let i = 0; i < 3; i++) addProp(i);
      if (move === 'alpha.roar') for (let i = 0; i < 12; i++) spawn(w, 'runner', 4 + i % 3, 3 + Math.floor(i / 3), 'idle');
      const advance = (n: number) => { for (let i = 0; i < n; i++) { w.props?.prePhysics(); step(w, 1); w.props?.postPhysics(); } };
      // Close Brute moves overlap: put the other move on cooldown to probe each available AI choice.
      if (move === 'alpha.ground-slam' || move === 'alpha.grab-human') {
        alpha.infected!.specialCooldowns = { 'alpha.charge': 1_000_000 };
        if (move === 'alpha.grab-human') alpha.infected!.specialCooldowns['alpha.ground-slam'] = 1_000_000;
      }
      advance(1);
      expect(alpha.infected!.specialAttack?.move, `${move}: selected by the AI`).toBe(move);
      const attackId = alpha.infected!.specialAttack!.attackId;
      if (missile) expect(missile.transform.y, `${move}: visible overhead pickup`).toBeGreaterThan(2);
      advance(infectedSpecialMoves[move].windup - 1);
      expect(w.events.events().filter(e => e.type === 'combat.hit' && e.attackId === attackId && e.sourceId === alpha.id), `${move}: no early damage`).toHaveLength(0);
      for (let i = 0; i < 240 && alpha.infected!.specialAttack?.stage !== 'recovery'; i++) advance(1);
      expect(alpha.infected!.specialAttack?.stage, `${move}: finishes`).toBe('recovery');
      expect(alpha.infected!.specialAttack!.projectile, `${move}: releases projectile ownership`).toBeUndefined();
      expect(alpha.infected!.specialAttack!.recoveryUntil - w.tick, `${move}: punish duration`).toBeGreaterThanOrEqual(48);
      expect(ai.startSpecial(alpha.id, move, { id: 1, x: 0, z: 0 }, { x, z: 0, radius: 1, dx: -1, dz: 0 }), `${move}: cooldown`).toBe(false);
      if (move === 'alpha.roar') {
        const calls = w.events.events().filter(e => e.type === 'infected.roar-buff' && e.sourceId === alpha.id && e.stage === 'active');
        expect(calls.length).toBeGreaterThanOrEqual(6); expect(calls.length).toBeLessThanOrEqual(10);
        expect(player.combat!.statuses.some(e => e.kind === 'stunned')).toBe(true);
      } else if (move === 'alpha.living-missile') {
        expect(missile!.health.current).toBeGreaterThan(0); expect(missile!.attachedTo).toBeUndefined();
        expect(missile!.combat!.staggerUntil - w.tick).toBeGreaterThanOrEqual(35);
      } else if (move === 'alpha.barrage') {
        expect(w.events.events().filter(e => e.type === 'infected.prop-thrown' && e.attackId === attackId)).toHaveLength(3);
        expect(w.props!.items.every(p => p.body.translation().x < x - 1)).toBe(true);
      } else {
        expect(w.events.events().some(e => e.type === 'infected.attack' && e.sourceId === alpha.id && e.targetId === 1 && e.amount > 0), `${move}: real contact`).toBe(true);
        if (move === 'alpha.grab-human') expect(Math.hypot(player.transform.x, player.transform.z)).toBeGreaterThan(5);
        if (move === 'alpha.pounce') expect(ai.playerPinned()).toBe(true);
      }
      if (move === 'alpha.grab-throw') {
        Object.assign(missile!.transform, { x: 5, z: 5 }); // Another thrower can now move this retained corpse.
        ai.cancelSpecial(alpha.id);
        expect([missile!.transform.x, missile!.transform.z], 'the old throw cannot reclaim a reused corpse').toEqual([5, 5]);
      }
      w.dispose(); worlds.splice(worlds.indexOf(w), 1);
    }
    // Interrupt/counter controls use the same resolver, including a zero-stagger hit during the inhale.
    for (const type of ['brute', 'screamer', 'leaper', 'armoured'] as const) {
      const w = await arena(1, false), ai = w.infected!, x = type === 'armoured' ? 1.8 : type === 'leaper' ? 10 : 6, alpha = w.entities.get(ai.spawn('infected.alpha', { x, z: 0 }, { alphaType: type, state: 'chase' }))!;
      const move = type === 'brute' ? 'alpha.charge' : alphaTypes[type].moves[0];
      ai.startSpecial(alpha.id, move, { id: 1, x: 0, z: 0 }, { x, z: 0, radius: 1, dx: -1, dz: 0 });
      if (type === 'screamer') {
        hit(w, alpha, 'melee', .01);
        expect(alpha.infected!.specialAttack?.stage).toBe('recovery');
      } else w.solids.relocate(w.entities.get(1)!, { x: 0, y: .7, z: 6 }, 'scripted.teleport');
      step(w, 150);
      expect(w.events.events().filter(e => e.type === 'infected.attack' && e.sourceId === alpha.id && e.amount > 0), `${type}: counter avoids special`).toHaveLength(0);
      w.dispose(); worlds.splice(worlds.indexOf(w), 1);
    }
    {
      const w = await arena(), armour = w.entities.get(w.infected!.spawn('infected.alpha', { x: 8, z: 0 }, { alphaType: 'armoured' }))!;
      const bullet: DamageEvent = { attackId: 8, actionId: 'weapon.handgun', sourceId: 1, targetId: armour.id, origin: { x: 10, z: 0 }, direction: { x: -1, z: 0 }, base: 100, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 };
      expect(damageAmount(bullet, armour)).toBe(25);
      expect(damageAmount({ ...bullet, origin: { x: 6, z: 0 } }, armour)).toBe(50);
      expect(damageAmount({ ...bullet, type: 'explosive' }, armour)).toBe(100);
    }
    {
      const w = await arena(), ai = w.infected!, alpha = w.entities.get(ai.spawn('infected.alpha', { x: 10, z: 0 }, { alphaType: 'armoured' }))!;
      const target = w.entities.get(w.spawnDummy('test.brace', { x: 11, z: 0 }, { hp: 300, faction: 'environment' }))!;
      target.kind = 'physics-prop';
      expect(ai.attackObstacle(alpha.id, target.id)).toBe(true); expect(ai.attackObstacle(alpha.id, target.id)).toBe(false);
      step(w, 31); expect(target.health.current).toBe(200);
    }
    // Big wrecks are reached at their surface; the actor cannot stand inside their hull to pick them up.
    {
      const w = await arena(), ai = w.infected!, alpha = w.entities.get(ai.spawn('infected.alpha', { x: 10, z: 0 }, { alphaType: 'thrower', state: 'chase' }))!;
      w.props = new PropSystem(w);
      const wreck = w.props.spawn({ id: 'alpha-wreck', assetId: 'veh.wreck', position: [14, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [11, 0, -1], max: [17, 2, 1] } });
      expect(wreck.mass).toBeLessThan(1500);
      expect(ai.props.nearestObject(alpha, 2)?.id).toBe(wreck.entityId);
      wreck.braced = true; expect(ai.props.nearestObject(alpha, 2)).toBeUndefined(); wreck.braced = false;
      expect(ai.startSpecial(alpha.id, 'alpha.grab-throw', { id: 1, x: -10, z: 0 }, { x: 10, z: 0, radius: 1, dx: -1, dz: 0 })).toBe(true);
      step(w, 48);
      expect(alpha.infected!.specialAttack!.projectile).toMatchObject({ objectId: wreck.entityId, physics: true, range: 20 });
      expect(wreck.body.linvel().x).toBeLessThan(-10);
      const before = structuredClone(alpha.infected!); ai.restoreSpecialTimers(before, 120);
      expect(before.alphaSpecialStarted).toBe(alpha.infected!.alphaSpecialStarted! + 120);
      expect(before.specialAttack!.projectile!.started).toBe(alpha.infected!.specialAttack!.projectile!.started + 120);
      expect(before.specialAttack!.projectile!.restoreVelocity).toBe(true);
    }
    {
      const w = await arena(1, false), ai = w.infected!, brute = w.entities.get(ai.spawn('infected.alpha', { x: 8, z: 0 }, { alphaType: 'brute', state: 'chase' }))!;
      ai.startSpecial(brute.id, 'alpha.charge', { id: 1, x: 0, z: 0 }, { x: 8, z: 0, radius: 1, dx: -1, dz: 0 });
      (w.combat!.query.dynamicWalls as CoverWall[]).push({ x: 5, z: 0, y: 1, halfX: .2, halfY: 2, halfZ: 3 }); w.combat!.query.invalidate();
      for (let i = 0; i < 120 && brute.infected!.specialAttack?.stage !== 'recovery'; i++) step(w, 1);
      expect(brute.infected!.specialAttack?.stage).toBe('recovery');
      expect(brute.combat!.staggerUntil - w.tick).toBe(90);
      expect(brute.infected!.specialAttack!.recoveryUntil - w.tick).toBe(90);
      expect(w.entities.get(1)!.health.current).toBe(w.entities.get(1)!.health.max);
    }
    {
      const rateWorld = await arena(1, false), alphas = [0, 1, 2].map(i => rateWorld.entities.get(rateWorld.infected!.spawn('infected.alpha', { x: 12 + i * 2, z: 0 }, { alphaType: 'brute', state: 'chase' }))!);
      alphas[1]!.infected!.pursuit = true; alphas[1]!.transform.x = 2; // The Mega shares the same admission slots.
      const start = (alpha: EntitySnapshot, follower = false) => rateWorld.infected!.startSpecial(alpha.id, 'alpha.charge', { id: 1, x: 0, z: 0 }, { x: alpha.transform.x, z: 0, radius: 1, dx: -1, dz: 0 }, follower);
      expect(start(alphas[0]!)).toBe(true); expect(start(alphas[1]!)).toBe(true); expect(start(alphas[2]!)).toBe(false); expect(start(alphas[2]!, true)).toBe(false);
      step(rateWorld, 60); expect(start(alphas[2]!)).toBe(true);
    }
    {
      const effectWorld = await arena(1, false), player = effectWorld.entities.get(1)!;
      const civilian = effectWorld.entities.get(effectWorld.npcs!.civilians.spawn('civilian', { x: 1, z: 2 }))!;
      civilian.combat!.staggerUntil = effectWorld.tick + 60;
      const screamer = effectWorld.entities.get(effectWorld.infected!.spawn('infected.alpha', { x: 4, z: 0 }, { alphaType: 'screamer', state: 'chase' }))!;
      expect(effectWorld.infected!.startSpecial(screamer.id, 'alpha.roar', { id: 1, x: 0, z: 0 }, { x: 4, z: 0, radius: 8, dx: -1, dz: 0 })).toBe(true);
      step(effectWorld, 60);
      expect(player.combat!.statuses.some(status => status.kind === 'stunned' && status.expires > effectWorld.tick)).toBe(true);
      expect(civilian.combat!.staggerUntil).toBe(effectWorld.tick + 60);
      const position = { ...civilian.transform };
      step(effectWorld, 30);
      expect(civilian.transform.x).toBeCloseTo(position.x, 6);
      expect(civilian.transform.z).toBeCloseTo(position.z, 6);
      player.combat!.staggerUntil = effectWorld.tick;
      player.combat!.statuses.length = 0;
      const brute = effectWorld.entities.get(effectWorld.infected!.spawn('infected.alpha', { x: 8, z: 0 }, { alphaType: 'brute', state: 'chase' }))!;
      expect(effectWorld.infected!.startSpecial(brute.id, 'alpha.ground-slam', { id: 1, x: 0, z: 0 }, { x: 8, z: 0, radius: 4, dx: -1, dz: 0 })).toBe(true);
      step(effectWorld, 61); expect(brute.infected!.specialAttack?.stage).toBe('recovery');
      const amount = effectWorld.combat!.damage.apply({ attackId: 88, actionId: 'weapon.bat', sourceId: 1, targetId: brute.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 10, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
      expect(amount).toBe(15);
    }
    {
      const missileWorld = await arena(1, false); missileWorld.infected!.configureL1v2();
      const thrower = missileWorld.entities.get(missileWorld.infected!.spawn('infected.alpha', { x: 10, z: 0 }, { alphaType: 'thrower', state: 'chase' }))!;
      const missile = missileWorld.entities.get(missileWorld.infected!.spawn('infected.runner', { x: 9, z: 0 }, { state: 'idle' }))!;
      expect(missileWorld.infected!.startSpecial(thrower.id, 'alpha.living-missile', { id: 1, x: 0, z: 0 }, { x: 10, z: 0, radius: 1, dx: -1, dz: 0 })).toBe(true);
      for (let i = 0; i < 100 && thrower.infected!.specialAttack?.stage !== 'recovery'; i++) step(missileWorld, 1);
      expect(missile.health.current).toBeGreaterThan(0);
      expect(missile.infected!.l1!.targetId).toBe(1); expect(missile.infected!.l1!.mode).toBe('chase');
      expect(missile.combat!.staggerUntil - missileWorld.tick).toBeGreaterThanOrEqual(35);
      expect(Math.hypot(missile.transform.x, missile.transform.z)).toBeGreaterThanOrEqual(1.5);
      expect(Math.hypot(missile.transform.x, missile.transform.z)).toBeLessThanOrEqual(3);
      step(missileWorld, 37); expect(['chase', 'attack']).toContain(missile.infected!.state);
    }
  } finally { for (const world of worlds.splice(firstWorld)) world.dispose(); }
}

test('every human and animal role validates and spawns with its catalog health and speed; every attack is telegraphed', async () => {
  await alphaTypeContracts();
  // Mission-specific acquisition ranges must not change the ordinary runner.
  for (const level of Array.from({ length: 10 }, (_, i) => `L${i + 1}`)) {
    const w = await arena(); w.scenario = level; w.infected!.configureL1v2();
    const e = spawn(w, 'runner', 2), brain = e.infected!.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0;
    step(w, 1);
    expect(w.events.events().some(event => event.type === 'telegraph' && event.sourceId === e.id), `${level}: shared lunge acquisition`).toBe(true);
    expect(e.health.max, `${level}: shared runner toughness`).toBe(humanInfected[0].hp * INFECTED_TOUGHNESS);
    expect(e.combat!.damageMultiplier, `${level}: no mission damage multiplier`).toBe(1);
  }
  {
    const w = await arena(); w.scenario = 'L3'; w.infected!.configureL1v2();
    const e = spawn(w, 'runner', 1.8), b = e.infected!, brain = b.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0;
    step(w, 1);
    const first = w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id)!;
    expect(first).toBeDefined();
    // Interrupt a real windup with a nonlethal hit. The original attack cycle
    // still owns recovery; a short flinch must not grant an immediate retry.
    w.combat!.damage.apply({ attackId: 999, actionId: 'weapon.handgun', sourceId: 1, targetId: e.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: .01, multiplier: 1, type: 'bullet', knockback: 0, stagger: .25 });
    step(w, Math.round(l1v2.infected.attackCycleS * 60) - 1);
    expect(w.events.events().filter(event => event.type === 'telegraph' && event.sourceId === e.id)).toHaveLength(1);
    step(w, 1);
    expect(w.events.events().filter(event => event.type === 'telegraph' && event.sourceId === e.id)).toHaveLength(2);
  }
  {
    const w = await arena(1, false); w.scenario = 'L5'; w.infected!.configureL1v2();
    const e = spawn(w, 'runner', 9), brain = e.infected!.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0;
    for (let i = 0; i < 180 && e.infected!.state !== 'attack'; i++) step(w, 1);
    const start = e.transform.x;
    expect(start).toBeGreaterThan(2); expect(start).toBeLessThanOrEqual(l1v2.infected.lungeRangeM);
    const warning = w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id);
    expect(warning).toMatchObject({ target: { id: 1 }, duration: .35 });
    step(w, 19);
    expect(e.transform.x, 'the L5 approach keeps moving during its warning').toBeLessThan(start - 1);
    expect(w.events.events().filter(event => event.type === 'combat.hit' && event.sourceId === e.id), 'no damage before the telegraph finishes').toHaveLength(0);
    step(w, 45);
    const hits = w.events.events().filter(event => event.type === 'combat.hit' && event.sourceId === e.id && event.targetId === 1);
    expect(hits.length, 'the moving approach must physically reach a stationary courier').toBeGreaterThan(0);
    expect(Math.hypot(e.transform.x, e.transform.z), 'the attack never extends its physical strike reach').toBeLessThanOrEqual(1.25);

    const resting = await arena(); resting.scenario = 'L5'; resting.infected!.configureL1v2();
    const stopped = spawn(resting, 'runner', 6), stoppedBrain = stopped.infected!.l1!;
    stoppedBrain.mode = 'chase'; stoppedBrain.targetId = 1; stoppedBrain.pauseUntil = 0;
    step(resting, 1);
    expect(resting.events.events().some(event => event.type === 'telegraph' && event.sourceId === stopped.id),
      'a stopped attacker cannot claim extra approach distance it has not built speed to cover').toBe(false);
  }

  {
    for (const moving of [false, true]) {
      const w = await arena(1, false); w.scenario = 'L6';
      const e = spawn(w, 'runner', 4.3);
      if (moving) w.setInput({ move: { x: -1, z: 0 } });
      step(w, 1);
      const cue = w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id);
      expect(cue, 'a distant ordinary runner must close before its shared warning').toBeUndefined();
      step(w, 179);
      const damage = w.events.events().filter(event => event.type === 'combat.hit' && event.targetId === 1 && event.amount > 0);
      expect(damage.length > 0, 'an out-of-reach runner can still be outrun').toBe(!moving);
      if (!moving) expect(damage[0]).toMatchObject({ amount: 10 });
    }
    const close = await arena(1, false); close.scenario = 'L2';
    const reaching = spawn(close, 'runner', 1.3);
    close.setInput({ move: { x: -1, z: 0 } }); step(close, 20);
    expect(close.events.events().some(event => event.type === 'combat.hit' && event.sourceId === reaching.id), 'windup stays readable').toBe(false);
    step(close, 40);
    const graze = close.events.events().find(event => event.type === 'combat.hit' && event.sourceId === reaching.id && event.amount > 0);
    const planted = await arena(1, false); planted.scenario = 'L2';
    const fullContact = spawn(planted, 'runner', 1.3); step(planted, 60);
    const plantedHit = planted.events.events().find(event => event.type === 'combat.hit' && event.sourceId === fullContact.id && event.amount > 0);
    expect(plantedHit, 'a planted target still takes the authored wound').toMatchObject({ amount: 10 });
    expect(graze?.type === 'combat.hit' && graze.amount, 'a moving lunge lands the same damage as a planted target').toBe(plantedHit?.type === 'combat.hit' && plantedHit.amount);

    const late = await arena(1, false); late.scenario = 'L6';
    const unchanged = spawn(late, 'runner', 1.3);
    late.setInput({ move: { x: -1, z: 0 } }); step(late, 60);
    expect(late.events.events().find(event => event.type === 'combat.hit' && event.sourceId === unchanged.id && event.amount > 0), 'later campaigns retain their authored moving damage').toMatchObject({ amount: 10 });

    for (const moving of [false, true]) {
      const ruined = await arena(1, false); ruined.scenario = 'L7';
      const runner = spawn(ruined, 'runner', 1.3);
      if (moving) ruined.setInput({ move: { x: -1, z: 0 } });
      step(ruined, 60);
      expect(ruined.events.events().find(event => event.type === 'combat.hit' && event.sourceId === runner.id && event.amount > 0),
        'L7 ordinary runner lunges retain their authored damage').toMatchObject({ amount: 10 });
    }

    const closing = await arena(1, false); closing.scenario = 'L2';
    const pursuer = spawn(closing, 'runner', 8);
    let warningDistance = 0;
    closing.events.on('telegraph', event => {
      if (event.type === 'telegraph' && event.sourceId === pursuer.id) {
        const player = closing.entities.get(1)!.transform;
        warningDistance = Math.hypot(pursuer.transform.x - player.x, pursuer.transform.z);
        expect(Math.hypot(event.target!.x - player.x, event.target!.z - player.z), 'ordinary lunge lead is bounded').toBeLessThanOrEqual(1.600001);
      }
    });
    for (let i = 0; i < 240 && !warningDistance; i++) { closing.setInput({ move: { x: -1, z: 0 }, walk: true }); closing.update(); }
    expect(warningDistance, 'a closing pursuer must warn before entering the old contact-only start ring').toBeGreaterThan(l1v2.infected.lungeRangeM);
  }

  {
    const w = await arena(); w.scenario = 'L6'; w.infected!.configureL1v2();
    const e = spawn(w, 'runner', 1.8), decoy = w.spawnDummy('human.decoy', { x: 24, z: 0 }, { faction: 'civilian' });
    const b = e.infected!, brain = b.l1!;
    brain.mode = 'chase'; brain.targetId = 1; brain.pauseUntil = 0; b.heardTargetId = decoy;
    step(w, 1);
    expect(w.events.events().find(event => event.type === 'telegraph' && event.sourceId === e.id)).toMatchObject({ target: { id: 1 } });
  }

  validateInfected(); expect(infectedDefinitions.every(def => def.bar)).toBe(true); expect(() => validateInfected([{ ...humanInfected[0], windup: 0.1 }])).toThrow();
  const w = await arena();
  for (const [i, def] of [...humanInfected, ...animalInfected].entries()) {
    const e = w.entities.get(w.infected!.spawn(def.id, { x: i * 2 - 12, z: 10 }, { perched: false }))!;
    expect(e.health.max, def.id).toBe(def.hp * INFECTED_TOUGHNESS); expect(e.infected!.speed, def.id).toBe(def.speed);
    if (e.infected!.hidden) { w.solids.relocate(e, { x: 2, y: .7, z: 0 }, 'scripted.teleport'); step(w, 6); }
    expect(e.combat!.radius, def.id).toBe(def.radius); expect(clickable(e), def.id).toBe(true);
    expect(w.combat!.query.nearby(e.transform, .001), def.id).toContain(e.id);
    expect(w.combat!.query.melee(1, e.transform, { x: 1, z: 0 }, .001, 360, 100).map(t => t.id), def.id).toContain(e.id);
    expect(w.combat!.query.ray(1, e.transform, { x: 1, z: 0 }, .001)?.id, def.id).toBe(e.id);
    expect(hit(w, e, 'melee', .01, e.transform), def.id).toBeGreaterThan(0);

  }
  for (const def of infectedDefinitions) {
    const t = await arena(1, false), e = spawn(t, def.id.slice(9), 0.9); if (def.special === 'explode') e.health.current = 0;
    step(t, 130);
    const log = t.events.events(), hits = log.filter(event => event.type === 'combat.hit' && (event.actionId.startsWith('infected.') || event.actionId.startsWith('alpha.')) && event.amount > 0);
    if (def.special !== 'scream') expect(hits.length, def.id).toBeGreaterThan(0);
    for (const event of hits) {
      if (event.type !== 'combat.hit') continue;
      const telegraph = log.find(entry => entry.type === 'telegraph' && entry.sourceId === event.sourceId && entry.attackId === event.attackId);
      expect(telegraph, def.id).toBeDefined(); expect(event.tick - telegraph!.tick, def.id).toBeGreaterThanOrEqual(def.special === 'charge' ? 48 : 21);
    }
  }
  // An approach windup must represent a real reachable attack, rather than
  // increasing the threat ledger with a leap that cannot reach its victim.
  const approach = await arena(1, false); approach.scenario = 'L10';
  const courier = approach.entities.get(1)!; courier.health.current = courier.health.max = 1000;
  const dog = spawn(approach, 'dog', 7), contacts: { tick: number; distance: number; amount: number }[] = [];
  approach.events.on('infected.attack', event => {
    if (event.type === 'infected.attack' && event.sourceId === dog.id && event.targetId === 1)
      contacts.push({ tick: event.tick, amount: event.amount, distance: Math.hypot(dog.transform.x - courier.transform.x, dog.transform.z - courier.transform.z) });
  });
  step(approach, 420);
  const warning = approach.events.events().find(e => e.type === 'telegraph' && e.sourceId === dog.id);
  expect(warning?.type === 'telegraph' && 'duration' in warning && warning.duration).toBeGreaterThanOrEqual(.6);
  expect(contacts.length, 'the telegraphed approach reaches a stationary courier').toBeGreaterThan(1);
  for (let i = 0; i < contacts.length; i++) {
    expect(contacts[i].distance, 'actual bite reach').toBeLessThanOrEqual(2);
    expect(contacts[i].amount, 'unarmored bite damage').toBe(10);
    if (i) expect(contacts[i].tick - contacts[i - 1].tick, 'bite cooldown').toBeGreaterThanOrEqual(120);
  }

  // Shared attack families must connect with actual running input. A cue or
  // attempted attack is insufficient: require accepted damage while moving.
  for (const role of [...infectedDefinitions.filter(def => def.special !== 'scream').map(def => def.id.slice(9)), 'mega-alpha']) {
    const w = await arena(1, false), player = w.entities.get(1)!;
    player.health.current = player.health.max = 10_000;
    const attacker = spawn(w, role === 'mega-alpha' ? 'alpha' : role, 1.3);
    attacker.infected!.hidden = false; attacker.infected!.perched = false;
    if (role === 'mega-alpha') { attacker.infected!.pursuit = true; attacker.infected!.speed = megaAlpha.cruiseMs; }
    let movingHits = 0, pendingHits = 0;
    w.events.on('infected.attack', event => {
      if (event.type === 'infected.attack' && event.sourceId === attacker.id && event.targetId === 1 && event.amount > 0) pendingHits++;
    });
    for (let i = 0; i < 600; i++) {
      const dx = player.transform.x + 3, dz = player.transform.z, radius = Math.hypot(dx, dz), correction = (3 - radius) * 2;
      const x = -dz + dx * correction, z = dx + dz * correction, length = Math.hypot(x, z);
      const before = { x: player.transform.x, z: player.transform.z };
      w.setInput({ move: { x: x / length, z: z / length } }); w.update();
      if (Math.hypot(player.transform.x - before.x, player.transform.z - before.z) * 60 > .2) movingHits += pendingHits;
      pendingHits = 0;
    }
    expect(movingHits, `${role}: a running circle cannot suppress every attack`).toBeGreaterThan(0);
    w.dispose(); worlds.pop();
  }
  // Light firearm hits keep a visible reaction while preserving heavy/Alpha windups.
  const fire = (w: SimWorld, target: EntitySnapshot) => w.combat!.damage.apply({ attackId: w.tick + 1, actionId: 'weapon.flamethrower', sourceId: 1, targetId: target.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 1, multiplier: 1, type: 'bullet', knockback: .1, stagger: .15 });
  for (const role of ['brute', 'butcher', 'armored', 'bloated', 'screamer', 'alpha']) {
    const w = await arena(), e = spawn(w, role, 2);
    e.infected!.state = 'attack'; e.infected!.until = w.tick + 60; e.combat!.attacking = true;
    for (let i = 0; i < 20; i++) { fire(w, e); step(w, 1); }
    expect(e.infected!.state, `${role}: windup state survives automatic fire`).toBe('attack');
    expect(e.combat!.attacking, `${role}: attack remains live`).toBe(true);
    expect(e.combat!.staggerUntil, `${role}: bullets do not install a stagger`).toBe(0);
  }
  {
    const w = await arena(), e = spawn(w, 'runner', 2);
    fire(w, e); const first = e.combat!.staggerUntil;
    expect(first).toBeGreaterThan(w.tick);
    for (let i = 0; i < 20; i++) { fire(w, e); step(w, 1); }
    expect(e.combat!.staggerUntil).toBe(first);
    step(w, 31); fire(w, e);
    expect(e.combat!.staggerUntil).toBe(w.tick + 9);
  }
  {
    const w = await arena(), e = spawn(w, 'brute', 2);
    fire(w, e); const first = e.combat!.staggerUntil;
    expect(first).toBe(w.tick + 9);
    step(w, 20); fire(w, e);
    expect(e.combat!.staggerUntil).toBe(first);
    step(w, 73); fire(w, e);
    expect(e.combat!.staggerUntil).toBe(w.tick + 9);
  }
  // Real catalog MG damage at contact: a heavy must finish an attack before dying.
  for (const role of ['brute', 'butcher']) {
    const w = await arena(1, false), e = spawn(w, role, 1.5), gun = action('weapon.army-mg');
    for (let i = 0; i < 600 && e.health.current > 0; i++) {
      if (i % Math.ceil(60 / gun.fireRate!) === 0) w.combat!.damage.apply({ attackId: i + 1, actionId: gun.id, sourceId: 1, targetId: e.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: gun.damage, multiplier: 1, type: 'bullet', knockback: gun.knockback, stagger: gun.stagger });
      step(w, 1);
    }
    const hits = w.events.events().filter(event => event.type === 'combat.hit' && event.sourceId === e.id && event.targetId === 1);
    if (process.env.S54_PROBE === '1') console.info(JSON.stringify({ scenario: 'catalog-mg-contact', role, ticks: w.tick, playerHitsLanded: hits.length, targetHp: e.health.current }));
    expect(hits.length, `${role}: reaches contact and attacks before real MG damage kills it`).toBeGreaterThan(0);
  }
  // Native 15 m firing matrix: three campaign gun tiers plus the authored
  // stagger-bearing light-firearm control. Hits use tiny damage to isolate AI.
  const weapons = [{ id: 'weapon.handgun', every: 20, stagger: 0 }, { id: 'weapon.assault-rifle', every: 8, stagger: 0 }, { id: 'weapon.army-mg', every: 6, stagger: 0 }, { id: 'weapon.flamethrower', every: 20, stagger: .15 }, { id: 'weapon.rotary-minigun', every: 3, stagger: .1 }];
  for (const role of ['brute', 'alpha', 'runner']) for (const weapon of weapons) {
    const w = await arena(1, false), e = spawn(w, role, 15);
    if (role === 'alpha') e.infected!.alphaType = 'brute';
    for (let i = 0; i < 600 && e.health.current > 0; i++) {
      if (i % weapon.every === 0) w.combat!.damage.apply({ attackId: i + 1, actionId: weapon.id, sourceId: 1, targetId: e.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: .01, multiplier: 1, type: 'bullet', knockback: 0, stagger: weapon.stagger });
      step(w, 1);
    }
    const hits = w.events.events().filter(event => event.type === 'combat.hit' && event.sourceId === e.id && event.targetId === 1);
    if (process.env.S54_PROBE === '1') console.info(JSON.stringify({ scenario: 'horde-arena-15m', role, weapon: weapon.id, ticks: w.tick, playerHitsLanded: hits.length, targetHp: e.health.current }));
    expect(hits.length, `${role}/${weapon.id}: attack connects through continuous fire (state=${e.infected!.state}, distance=${Math.hypot(e.transform.x, e.transform.z).toFixed(1)}, tick=${w.tick})`).toBeGreaterThan(0);
    if (role === 'alpha') expect(hits.some(event => event.type === 'combat.hit' && event.actionId.startsWith('alpha.')), `${weapon.id}: Alpha uses a signature move`).toBe(true);
  }
});

test('perception: sight cone, facing-independent gunshots, silent melee misses, bounded kill noise, screamer radius', async () => {
  const w = await arena();
  // r31-aggro (PO 11-10): a courier hit outranks a director assignment (it used to be ignored while the infected was pressed at a survivor).
  const pressed = spawn(w, 'runner', 4);
  pressed.infected!.pressureTarget = { id: 999, until: w.tick + 600 };
  hit(w, pressed, 'bullet', 1);
  expect(pressed.infected!.provoked?.id).toBe(1);
  expect(pressed.infected!.pressureTarget).toBeUndefined();
  w.infected!.release(pressed);
  const inside = w.infected!.spawn('infected.runner', { x: -10, z: 0 }), outside = w.infected!.spawn('infected.runner', { x: 10, z: 0 });
  const far = w.infected!.spawn('infected.runner', { x: -15, z: 0 }), angle = w.infected!.spawn('infected.runner', { x: -5, z: 10 });
  step(w, 18);
  expect(w.entities.get(inside)!.infected!.state).toBe('chase');
  for (const id of [outside, far, angle]) expect(w.entities.get(id)!.infected!.state).toBe('idle');
  w.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']); w.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(w, 1); w.clearInput(); step(w, 17);
  for (const id of [outside, far, angle]) expect(w.entities.get(id)!.infected!.state).toBe('chase');

  const n = await arena();
  const near = n.entities.get(n.infected!.spawn('infected.runner', { x: 0, z: 5 }))!, beyond = n.entities.get(n.infected!.spawn('infected.runner', { x: 0, z: 7 }))!;
  const swing = () => { n.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(n, 1); n.clearInput(); step(n, 30); };
  n.combat!.setLoadout(['weapon.bat'], ['weapon.grenade']); swing();
  expect(near.infected!.state).toBe('idle'); expect(n.events.events().filter(e => e.type === 'noise')).toHaveLength(0);
  const victim = n.entities.get(n.infected!.spawn('infected.runner', { x: 1, z: 0 }))!; victim.health.current = 1;
  swing();
  expect(near.infected!.state).not.toBe('idle'); expect(beyond.infected!.state).toBe('idle');
  expect(n.events.events().some(e => e.type === 'noise' && e.actionId === 'weapon.bat' && e.radius === 6)).toBe(true);

  const s = await arena(); spawn(s, 'screamer', 1);
  const within = spawn(s, 'runner', 20.5, 0, 'idle'), past = spawn(s, 'runner', 22, 0, 'idle'); step(s, 51);
  expect(within.infected!.state).not.toBe('idle'); expect(past.infected!.state).toBe('idle');

  // A delayed L3 gunfire spill remembers the noise, not the shooter's later
  // live position. Losing a designated officer must not grant a player target.
  const { world: retreat, mission } = await loadL3(1, 'low'); worlds.push(retreat);
  const player = retreat.entities.get(1)!;
  Object.assign(player.transform, { x: 120, z: 0 }); followFrustum(retreat);
  for (const e of [...retreat.infected!.active]) retreat.infected!.release(e);
  const state = mission.state.l3!, home = { x: -15, z: 0 };
  state.phase = 'corridor'; state.fallbackAt = 1; state.waves = [];
  const door = Object.keys(mission.def.anchors).filter(name => name.startsWith('refuge-door-'))
    .sort((a, b) => Math.hypot(mission.def.anchors[a].x - home.x, mission.def.anchors[a].z - home.z) - Math.hypot(mission.def.anchors[b].x - home.x, mission.def.anchors[b].z - home.z))[0];
  const controller = mission.l3! as unknown as { emergePending(all: boolean): void };
  const officer = retreat.entities.get(state.officerIds[0])!; officer.health.current = 0;
  for (const targetId of [1, officer.id]) {
    const entry = { id: 0, door, home, segment: 1, at: retreat.tick, kind: 'spill' as const, targetId };
    state.pending = [entry]; controller.emergePending(true);
    expect(entry.id, 'the native offscreen spill is actually admitted').toBeGreaterThan(0);
    const e = retreat.entities.get(entry.id)!, brain = e.infected!.l1!;
    expect(brain.focusId, 'noise must not reveal the courier at her new position').not.toBe(1);
    expect([brain.search.originX, brain.search.originZ]).toEqual([home.x, home.z]);
    retreat.infected!.release(e);
  }

  // PO 2026-11-10 ("L3 police team doesn't loose any health"): infected that reach a following squad officer land their normal
  // melee hit (runner damage, no bite), wear his shown health down and kill him with the last hit.
  const { world: duel } = await loadL3(1, 'low'); worlds.push(duel);
  for (const e of [...duel.infected!.active]) duel.infected!.release(e);
  const ds = duel.missions!.state.l3!, cop = duel.entities.get(ds.squadIds[0])!;
  ds.squad = [{ id: cop.id, farSince: 0 }];
  let dmg = 0;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, r = duel.entities.get(duel.infected!.spawn('infected.runner', { x: cop.transform.x + Math.cos(a) * 1.4, z: cop.transform.z + Math.sin(a) * 1.4 }, { state: 'chase' }))!;
    r.health.current = r.health.max = 1e6; r.infected!.l1!.targetId = cop.id; r.infected!.l1!.mode = 'chase'; dmg = 10 * r.combat!.damageMultiplier;
  }
  cop.health.current = 200;
  const hits: number[] = []; duel.events.on('infected.attack', ev => { if (ev.type === 'infected.attack' && ev.targetId === cop.id && ev.special !== 'bite') hits.push(ev.amount); });
  step(duel, 600);
  expect(hits.length, 'a plain melee hit lands on the officer').toBeGreaterThan(0);
  expect(hits.some(a => a === dmg), 'the hit is the runner melee damage').toBe(true);
  expect(cop.health.current, 'a pack of six wears the officer down to death').toBeLessThan(200);
});

test('all levels recover nonlethal downs after seeded 10-20 s at full HP; explosives and burns kill for good', async () => {
  const downTicks: number[] = [];
  for (const seed of [1, 2, 3, 1]) {
    const w = await arena(seed); w.infected!.configureL1v2();
    const e = w.entities.get(w.infected!.spawn('infected.runner', { x: 6, z: 0 }, { yaw: 0, variant: 'inf.cashier' }))!;
    step(w, 2); hit(w, e);
    const downAt = w.tick, recoverAt = e.infected!.recoverAt;
    expect(e.health.current).toBe(0);
    expect(e.infected!.knockdowns).toBe(1);
    expect(recoverAt - downAt).toBeGreaterThanOrEqual(lowS * 60); expect(recoverAt - downAt).toBeLessThanOrEqual(highS * 60);
    downTicks.push(recoverAt - downAt);
    step(w, 200);
    expect(e.corpse).toBeFalsy(); expect(e.infected!.state).toBe('dead');
    const hitAt = w.tick; hit(w, e);
    const reset = e.infected!.recoverAt;
    expect(e.infected!.knockdowns, 'hitting the floor body is not a second knockdown').toBe(1);
    expect(reset - hitAt).toBeGreaterThanOrEqual(lowS * 60);
    step(w, reset - w.tick - 1); expect(e.health.current).toBe(0);
    step(w, 2); expect(e.health.current).toBe(e.health.max); expect(e.infected!.state).not.toBe('dead'); expect(e.corpse).toBeFalsy();
    hit(w, e); expect(e.infected!.knockdowns).toBe(2);
    w.infected!.release(e);
    const replacement = w.entities.get(w.infected!.spawn('infected.runner', { x: 6, z: 0 }))!;
    expect(replacement.infected!.knockdowns, 'a pooled brain must not inherit the policy counter').toBeUndefined();
  }
  expect(downTicks[3]).toBe(downTicks[0]);
  expect(new Set(downTicks.slice(0, 3)).size).toBeGreaterThan(1);

  const w = await arena(3); w.infected!.configureL1v2();
  const z = (x: number, zz: number) => w.entities.get(w.infected!.spawn('infected.runner', { x, z: zz }, { yaw: 0, variant: 'inf.cashier' }))!;
  const blasted = z(6, 0), downed = z(-6, 0), burned = z(0, 6);
  step(w, 2); hit(w, blasted, 'explosive'); expect(blasted.infected!.recoverAt).toBe(-1);
  hit(w, downed); step(w, 30); hit(w, w.entities.get(downed.id)!, 'explosive', 40);
  w.combat!.status.apply(burned, { kind: 'burning', duration: 10, maxStacks: 1, dps: 15, slow: 0 }, 1, 'throw.molotov');
  step(w, 60 * highS + 300);
  for (const e of [blasted, downed, burned]) { expect(w.entities.get(e.id)!.health.current).toBe(0); expect(w.entities.get(e.id)!.corpse, `${e.id} is a corpse`).toBe(true); }
  // A nurse may accelerate a recoverable down, never undo an explosive kill.
  {
    const w = await arena();
    const blasted = spawn(w, 'runner', 4, -1), recoverable = spawn(w, 'runner', 4, 1);
    hit(w, blasted, 'explosive'); hit(w, recoverable);
    const nurse = spawn(w, 'nurse', 6);
    step(w, 120);
    expect(recoverable.health.current).toBe(recoverable.health.max);
    expect(nurse.infected!.reviveUsed).toBe(true);
    expect(w.entities.get(blasted.id)!.health.current).toBe(0);
  }
  // Strict admission reserves downed actors' existing slots; no level may
  // silently turn a recoverable body into a permanent corpse to free a slot.
  for (const level of Array.from({ length: 10 }, (_, i) => `L${i + 1}`)) {
    const w = await arena(1); w.scenario = level;
    w.infected!.director.strict = true; w.infected!.director.levelCap = 60;
    const bodies = Array.from({ length: 13 }, (_, i) => spawn(w, 'runner', -12 + i * 2, 8));
    const rocketVictim = spawn(w, 'runner', 15, 8);
    w.combat!.damage.apply({ attackId: 1000, actionId: 'weapon.rocket-launcher', sourceId: 1, targetId: rocketVictim.id,
      origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 999, multiplier: 1,
      type: 'explosive', knockback: 0, stagger: 0 });
    expect(rocketVictim.infected!.recoverAt, `${level}: rocket kills remain permanent`).toBe(-1);
    const risen = new Set<number>();
    w.events.on('infected.recovered', event => { if (event.type === 'infected.recovered') risen.add(event.sourceId); });
    for (const [i, body] of bodies.entries()) {
      const actionId = ['weapon.fire-axe', 'weapon.handgun', 'weapon.shotgun'][i % 3];
      w.combat!.damage.apply({ attackId: i + 1, actionId, sourceId: 1, targetId: body.id,
        origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 999, multiplier: 1,
        type: i % 3 ? 'bullet' : 'melee', knockback: 0, stagger: 0 });
      expect(body.infected!.recoverAt - w.tick, `${level}/${actionId}`).toBeGreaterThanOrEqual(lowS * 60);
      expect(body.infected!.recoverAt - w.tick, `${level}/${actionId}`).toBeLessThanOrEqual(highS * 60);
    }
    expect(w.infected!.director.count, level).toBe(13);
    step(w, highS * 60 + 2);
    for (const body of bodies) {
      expect(body.health.current, `${level}/${body.id}`).toBe(body.health.max);
      expect(body.corpse, `${level}/${body.id}`).toBeFalsy();
      expect(risen.has(body.id), `${level}: actual recovery event`).toBe(true);
    }
    expect(w.entities.get(rocketVictim.id)?.health.current, `${level}: rocket victim stays down`).toBe(0);
    expect(w.entities.get(rocketVictim.id)?.corpse, `${level}: rocket corpse persists`).toBe(true);
    w.dispose(); worlds.splice(worlds.indexOf(w), 1);
  }
});

test('bodies: a pile-up holds the melee ring yet keeps landing hits; large roles keep contact clearance; corpses persist past 100 bodies', async () => {
  const w = await arena(1, false), player = w.entities.get(1)!, start = player.health.current;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; w.infected!.spawn('infected.runner', { x: player.transform.x + Math.cos(a) * 3, z: player.transform.z + Math.sin(a) * 3 }, { state: 'chase' }); }
  let closest = Infinity, attacking = 0;
  for (let tick = 0; tick < 300; tick++) {
    w.update(); if (tick < 120) continue;
    for (const e of w.infected!.active) { closest = Math.min(closest, Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)); if (e.infected!.state === 'attack') attacking++; }
  }
  expect(meleeRing).toBeLessThan(1.1); expect(closest).toBeGreaterThan(meleeRing - .03);
  expect(attacking).toBeGreaterThan(100); expect(player.health.current).toBeLessThan(start);

  for (const role of ['infected.butcher', 'infected.gorilla']) {
    const b = await arena(1, false), p = b.entities.get(1)!, hp = p.health.current;
    const e = b.entities.get(b.infected!.spawn(role, { x: p.transform.x + 3, z: p.transform.z }, { state: 'chase' }))!;
    for (let tick = 0; tick < 240; tick++) {
      b.update();
      expect(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), role).toBeGreaterThanOrEqual(infectedContactDistance(e.combat!.radius) - .002);
    }
    expect(p.health.current, role).toBeLessThan(hp);
  }

  const c = await arena(), ids: number[] = [];
  for (let i = 0; i < 101; i++) { const corpse = spawn(c, 'runner', i % 20 - 10, 10 + Math.floor(i / 20), 'idle'); ids.push(corpse.id); corpse.health.current = 0; }
  step(c, 121); expect(c.infected!.active).toHaveLength(0);
  for (const id of ids) expect(c.entities.get(id)?.corpse).toBe(true);
});

test('recovered infected forget the chase: re-acquisition needs sight, not memory', async () => {
  const w = await arena(4); w.infected!.configureL1v2();
  const player = w.entities.get(1)!;
  const e = w.entities.get(w.infected!.spawn('infected.runner', { x: player.transform.x + 6, z: player.transform.z }, { yaw: Math.PI, variant: 'inf.cashier' }))!;
  const alerts: GameEvent[] = [];
  w.events.on('ai.alerted', ev => { if (ev.type === 'ai.alerted' && ev.targetId === e.id) alerts.push(ev); });
  for (let i = 0; i < 120 && e.infected!.l1!.mode !== 'chase'; i++) step(w, 1);
  expect(e.infected!.l1!.mode).toBe('chase');
  hit(w, e);
  step(w, e.infected!.recoverAt - w.tick + 2);
  expect(e.health.current).toBe(e.health.max);
  expect(e.infected!.l1!.mode).not.toBe('chase');
});
