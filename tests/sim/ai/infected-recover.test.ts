import { afterEach, expect, test } from 'vitest';
import { infectedRecovery } from '../../../src/data/infected';
import type { DamageEvent } from '../../../src/sim/combat/Damage';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import type { EntitySnapshot, GameEvent } from '../../../src/sim/world/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';

/** PO rule "Infected recover" (specs/00-game-concept.md, 2026-10-08): melee only knocks infected down; explosives kill. */
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(seed = 1, l1 = true) {
  const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', seed);
  const perception = l1 ? w.infected!.configureL1v2() : null; w.combat!.damage.god = true;
  return { w, ai: w.infected!, perception };
}
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const zombie = (w: SimWorld, x: number, z: number, yaw = 0): EntitySnapshot => w.entities.get(w.infected!.spawn('infected.runner', { x, z }, { yaw, variant: 'inf.cashier' }))!;
function hit(w: SimWorld, e: EntitySnapshot, type: DamageEvent['type'] = 'melee', base = 999): number {
  return w.combat!.damage.apply({ attackId: 1, actionId: type === 'explosive' ? 'weapon.grenade' : 'weapon.bat', sourceId: 1, targetId: e.id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base, multiplier: 1, type, knockback: 0, stagger: 0 });
}
type Kill = Extract<GameEvent, { type: 'combat.hit' | 'combat.kill' }>;
const [lowS, highS] = infectedRecovery.downS;

test('T-recover-01 @E05 @E19 a lethal melee hit knocks down: 10-20 s on the ground (deterministic per seed), hits never extend it, then up at full HP', async () => {
  const downTicks: number[] = [];
  for (const seed of [1, 2, 3, 4, 5, 1]) {
    const { w } = await arena(seed);
    const e = zombie(w, 6, 0), kills: GameEvent[] = [];
    w.events.on('combat.kill', ev => { kills.push(ev); });
    step(w, 2); hit(w, e);
    const downAt = w.tick, recoverAt = e.infected!.recoverAt;
    expect(e.health.current).toBe(0);
    expect(kills).toHaveLength(1); expect((kills[0] as Kill).downed).toBe(recoverAt);
    expect(recoverAt - downAt).toBeGreaterThanOrEqual(lowS * 60); expect(recoverAt - downAt).toBeLessThanOrEqual(highS * 60);
    downTicks.push(recoverAt - downAt);
    step(w, 200);
    // Down, not dead: still an active brain (no corpse record), still on the ground; ground hits change nothing.
    const body = w.entities.get(e.id)!;
    expect(body.corpse).toBeFalsy(); expect(body.infected!.state).toBe('dead');
    expect(hit(w, body)).toBe(0); expect(body.infected!.recoverAt).toBe(recoverAt); expect(kills).toHaveLength(1);
    step(w, recoverAt - w.tick - 1);
    expect(body.health.current).toBe(0);
    step(w, 2);
    expect(body.health.current).toBe(body.health.max); expect(body.infected!.state).not.toBe('dead');
    expect(body.infected!.recoverAt).toBe(-1); expect(body.corpse).toBeFalsy();
    // The get-up reads clearly: a heavy reaction from its get-up mark, standing still meanwhile.
    expect(body.combat!.reaction!.heavy).toBe(true); expect(body.combat!.staggerUntil).toBeGreaterThan(w.tick);
    // It can be knocked down again, with its own fresh draw.
    hit(w, body); expect(body.health.current).toBe(0); expect(body.infected!.recoverAt).toBeGreaterThan(w.tick + lowS * 60 - 1);
  }
  expect(downTicks[5]).toBe(downTicks[0]);
  expect(new Set(downTicks.slice(0, 5)).size).toBeGreaterThan(1);
});

test('T-recover-02 @E05 @E27 explosives kill for good and leave a persistent corpse; a blast or a lethal burn finishes a downed infected', async () => {
  const { w } = await arena(3);
  const blasted = zombie(w, 6, 0), downed = zombie(w, -6, 0), burned = zombie(w, 0, 6);
  step(w, 2);
  hit(w, blasted, 'explosive');
  expect(blasted.infected!.recoverAt).toBe(-1);
  hit(w, downed); expect(downed.infected!.recoverAt).toBeGreaterThan(0);
  const kills: Kill[] = [];
  w.events.on('combat.kill', ev => { if (ev.type === 'combat.kill') kills.push(ev); });
  step(w, 30); hit(w, w.entities.get(downed.id)!, 'explosive', 40);
  expect(kills.map(k => [k.targetId, k.downed])).toEqual([[downed.id, undefined]]);
  w.combat!.status.apply(burned, { kind: 'burning', duration: 10, maxStacks: 1, dps: 15, slow: 0 }, 1, 'throw.molotov');
  step(w, 60 * highS + 300);
  for (const e of [blasted, downed, burned]) {
    const body = w.entities.get(e.id)!;
    expect(body.health.current, `${e.id} stays dead`).toBe(0); expect(body.corpse, `${e.id} is a corpse`).toBe(true);
  }
});

test('T-recover-03 @E19 a recovered infected forgets its chase and re-acquires only by sight', async () => {
  const { w, perception } = await arena(4);
  const player = w.entities.get(1)!, e = zombie(w, player.transform.x + 6, player.transform.z, Math.PI);
  const alerts: Extract<GameEvent, { type: 'ai.alerted' }>[] = [];
  w.events.on('ai.alerted', ev => { if (ev.type === 'ai.alerted' && ev.targetId === e.id) alerts.push(ev); });
  for (let i = 0; i < 120 && e.infected!.l1!.mode !== 'chase'; i++) step(w, 1);
  expect(e.infected!.l1!.mode).toBe('chase');
  hit(w, e);
  // While it lies there a full-height wall goes up between it and the courier.
  const midX = (e.transform.x + player.transform.x) / 2, cover: CoverWall = { x: midX, y: 1.5, z: player.transform.z, halfX: .2, halfY: 1.5, halfZ: 8 };
  (w.combat!.query.walls as CoverWall[]).push(cover);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 9001, wall: cover, blocked: true } as never);
  step(w, e.infected!.recoverAt - w.tick + 1);
  expect(e.health.current).toBe(e.health.max);
  const brain = e.infected!.l1!; alerts.length = 0;
  expect(brain.mode).not.toBe('chase'); expect(brain.targetId).toBe(0);
  for (let i = 0; i < 300; i++) { step(w, 1); expect(brain.mode, `tick ${i}: no chase without sight`).not.toBe('chase'); }
  expect(alerts).toHaveLength(0);
  // Wall down, courier in its view: a sighting (cone + LOS) starts the chase again.
  (w.combat!.query.walls as CoverWall[]).splice((w.combat!.query.walls as CoverWall[]).indexOf(cover), 1);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: 9001, wall: cover, blocked: false } as never);
  e.transform.yaw = -Math.atan2(player.transform.z - e.transform.z, player.transform.x - e.transform.x);
  expect(perception!.sees(e, player.transform)).toBe(true);
  for (let i = 0; i < 120 && brain.mode !== 'chase'; i++) step(w, 1);
  expect(brain.mode).toBe('chase'); expect(alerts.map(a => a.cause)).toEqual(['sight']);
});
