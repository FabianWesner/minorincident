import { expect, test, vi } from 'vitest';
import { arena, spawn, step } from './helpers';
import { MegaPursuit } from '../../../src/sim/ai/MegaPursuit';

// PO 10-16: "Alpha awareness: needs to be level independent".
for (const level of Array.from({ length: 10 }, (_, i) => `L${i + 1}`)) {
  for (const target of ['courier', 'companion', 'ally'] as const) test(`T-E07-06-awareness @E07 @E07-AC06 ${level} Alpha hears ${target} through cover and turns/roars`, async () => {
    const w = await arena(); w.scenario = level; w.combat!.damage.god = true;
    const player = w.entities.get(1)!;
    Object.assign(player.transform, { x: target === 'courier' ? -3.8 : -30, z: 0 });
    w.physics.playerBody!.setTranslation(player.transform, true);
    const id = target === 'courier' ? 1 : w.npcs!.civilians.spawn('worker', { x: -3.8, z: 0 }, { waypoints: [{ x: -3.8, z: 0 }] });
    const human = w.entities.get(id)!;
    if (target === 'companion') human.civilian!.survivor = { key: 'probe', mode: 'follow', slot: 0, leader: 1, cover: false, waitAt: 0, foundAt: 0 };
    if (target === 'ally') human.civilian!.ally = { role: 'soldier', engaged: false, run: null, runSpeed: 3, post: null, hold: true, targetId: 0, nextAttack: 0, hits: 0, forceUntil: 0 };
    vi.spyOn(w.npcs!, 'update').mockImplementation(() => {});
    const ai = w.infected!, alpha = w.entities.get(ai.spawn('infected.alpha', { x: 0, z: 0 }, { state: 'idle', ...(level === 'L10' ? { cureRegion: 'industrial-area' as const } : {}) }))!;
    ai.hearing.los.register({ id: 'wall', source: 'building', active: true, shape: { kind: 'aabb', min: { x: -2, z: -4 }, max: { x: -1.8, z: 4 } } });
    expect(ai.hearing.sees(alpha, human.transform)).toBe(false);
    step(w, 1);
    expect(alpha.infected!.heardTargetId).toBe(id);
    expect(alpha.infected!.state).toBe('alerted');
    expect(w.events.events().filter(e => e.type === 'ai.alerted' && e.targetId === alpha.id)).toContainEqual(expect.objectContaining({ sourceId: id, cause: 'hearing' }));
    expect(w.events.events().filter(e => e.type === 'telegraph' && e.sourceId === alpha.id)).toContainEqual(expect.objectContaining({ special: 'alpha.roar', duration: .6 }));
    step(w, 6); expect(Math.abs(alpha.transform.yaw)).toBeGreaterThan(.5);
    expect(Math.hypot(alpha.transform.x, alpha.transform.z)).toBeLessThan(.05);
    step(w, 36); expect(['chase', 'attack']).toContain(alpha.infected!.state);
  });
}

test('T-E07-06-noise @E07 @E07-AC06 quiet/walk/run/shot radii scale without changing ordinary infected or L5', async () => {
  const w = await arena(), ai = w.infected!, player = w.entities.get(1)!;
  const alpha = spawn(w, 'alpha', 0, 0, 'idle'), regular = spawn(w, 'runner', 0, 2, 'idle');
  Object.assign(player.transform, { x: -5, z: 0 });
  expect(ai.hearing.hears(alpha, player.transform)).toBe(false);
  player.survivor!.velocity = { x: 2, z: 0 };
  expect(ai.hearing.hears(alpha, player.transform)).toBe(true);
  player.transform.x = -8; expect(ai.hearing.hears(alpha, player.transform)).toBe(false);
  player.survivor!.velocity.x = 4;
  expect(ai.hearing.hears(alpha, player.transform)).toBe(true);
  player.transform.x = -11; expect(ai.hearing.hears(alpha, player.transform)).toBe(false);
  w.events.emit({ type: 'combat.attack', tick: w.tick, sourceId: 1, attackId: 999, actionId: 'weapon.handgun', side: 'LEFT', position: { ...player.transform }, direction: { x: 1, z: 0 } });
  expect(ai.hearing.hears(alpha, player.transform)).toBe(true);
  expect(ai.hearing.hears(regular, player.transform)).toBe(false);
  player.transform.x = -12.01; expect(ai.hearing.hears(alpha, player.transform)).toBe(false);
  w.tick += 60; player.transform.x = -11; expect(ai.hearing.hears(alpha, player.transform)).toBe(false);
  player.survivor!.velocity.x = 0; player.transform.x = -5; w.scenario = 'L5';
  expect(ai.hearing.hears(alpha, player.transform)).toBe(true);
  expect(ai.hearing.hears(regular, player.transform)).toBe(true);
});

test('T-E07-06-mega @E07 @E07-AC06 Mega notices an ally through cover then resumes its courier pursuit', async () => {
  const w = await arena(), ai = w.infected!; w.scenario = 'L10';
  const player = w.entities.get(1)!; player.transform.x = 25; w.physics.playerBody!.setTranslation(player.transform, true);
  const id = w.npcs!.civilians.spawn('worker', { x: -3.8, z: 0 }, { waypoints: [{ x: -3.8, z: 0 }] });
  vi.spyOn(w.npcs!, 'update').mockImplementation(() => {});
  const boss = w.megaPursuit = new MegaPursuit(w, { spawn: { x: 0, z: 0 }, introduceTick: null }); boss.introduce();
  const mega = ai.active.find(e => e.infected?.pursuit)!;
  ai.hearing.los.register({ id: 'wall', source: 'building', active: true, shape: { kind: 'aabb', min: { x: -2, z: -4 }, max: { x: -1.8, z: 4 } } });
  step(w, 7);
  expect(mega.infected!.proximityNotice?.id).toBe(id);
  expect(Math.abs(mega.transform.yaw)).toBeGreaterThan(.5);
  expect(w.events.events().filter(e => e.type === 'telegraph' && e.sourceId === mega.id)).toContainEqual(expect.objectContaining({ special: 'alpha.roar' }));
  step(w, 60);
  expect(mega.infected!.heardTargetId).toBe(0);
  expect(boss.state.target.x).toBeGreaterThan(20);
  expect(mega.transform.x).toBeGreaterThan(0);
  expect(w.events.events().filter(e => e.type === 'ai.alerted' && e.targetId === mega.id)).toHaveLength(1);
});

test('T-E07-06-human-noise @E07 @E07-AC06 ally gunfire and companion movement scale hearing; cowering shrinks it', async () => {
  const w = await arena(), ai = w.infected!, player = w.entities.get(1)!;
  player.transform.x = -30;
  const id = w.npcs!.civilians.spawn('worker', { x: -5, z: 0 }, { waypoints: [{ x: -5, z: 0 }] });
  const human = w.entities.get(id)!, alpha = spawn(w, 'alpha', 0, 0, 'idle');
  human.motion = { velocity: { x: 2, z: 0 }, speed: 2, moving: true, distance: 0 };
  expect(ai.hearing.hears(alpha, human.transform, id)).toBe(true);
  human.civilian!.story = { clip: 'npc-cower', start: 0 };
  expect(ai.hearing.hears(alpha, human.transform, id)).toBe(false);
  human.civilian!.story = null; human.motion.velocity.x = 4; human.transform.x = -8;
  expect(ai.hearing.closestHeard(alpha)?.id).toBe(id);
  human.transform.x = -11; expect(ai.hearing.hears(alpha, human.transform, id)).toBe(false);
  w.events.emit({ type: 'ally.attack', tick: w.tick, sourceId: id, targetId: alpha.id, role: 'soldier', from: { ...human.transform }, to: { ...alpha.transform }, hit: false });
  expect(ai.hearing.closestHeard(alpha)?.id).toBe(id);
  w.scenario = 'L5'; expect(ai.hearing.hears(alpha, human.transform, id)).toBe(false);
});

test('T-E07-06-chasing @E07 @E07-AC06 a chasing Alpha notices a nearby ally instead of ignoring it for the distant courier', async () => {
  const w = await arena(), ai = w.infected!, player = w.entities.get(1)!;
  player.transform.x = -30; w.physics.playerBody!.setTranslation(player.transform, true);
  const id = w.npcs!.civilians.spawn('worker', { x: -3.8, z: 0 }, { waypoints: [{ x: -3.8, z: 0 }] });
  vi.spyOn(w.npcs!, 'update').mockImplementation(() => {});
  const alpha = spawn(w, 'alpha', 0, 0, 'chase');
  step(w, 1);
  expect(alpha.infected!.heardTargetId).toBe(id);
  expect(alpha.infected!.state).toBe('alerted');
  expect(w.events.events()).toContainEqual(expect.objectContaining({ type: 'telegraph', sourceId: alpha.id, special: 'alpha.roar' }));
  step(w, 6); expect(Math.abs(alpha.transform.yaw)).toBeGreaterThan(.5);
  expect(ai.hearing.humans.get(id)).toBeDefined();
});

test('T-E07-06-known-target @E07 @E07-AC06 proximity does not restart discovery for a courier already being chased', async () => {
  const w = await arena(), player = w.entities.get(1)!;
  player.transform.x = -3.8; w.physics.playerBody!.setTranslation(player.transform, true);
  const alpha = spawn(w, 'alpha', 0, 0, 'chase'); step(w, 1);
  expect(alpha.infected!.state).not.toBe('alerted');
  expect(w.events.events().filter(e => e.type === 'ai.alerted' && e.targetId === alpha.id)).toHaveLength(0);
});
