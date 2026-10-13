import { expect, test } from 'vitest';
import { megaAlpha } from '../../../src/data/megaAlpha';
import { captureSeams, restoreSeams } from '../../../src/sim/missions/l1Seams';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { arena, dummy, equip, health, step } from './helpers';

const SPIN_S = .4;
/** The gun at (0, 4) facing +x; the player behind it, on the same level (no deck unless `deck` is given). */
async function manned(deck = 0) {
  const w = await arena();
  const gun = w.installMountedGun({ x: 0, z: 4, y: deck, yaw: 0 });
  teleport(w, -1.2, 4, deck + .705);
  return { w, gun };
}
function teleport(w: SimWorld, x: number, z: number, y = .705) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x, z, y });
  w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}
/** One interact press: an edge tick, then a released tick. */
function press(w: SimWorld) { w.clearInput(); w.setInput({ interact: true }); step(w, 1); w.clearInput(); step(w, 1); }
function trigger(w: SimWorld, aim = { x: 1, z: 0 }) { w.setInput({ aim, left: { down: true, held: true, up: false } }); }
const count = (w: SimWorld) => w.events.events().filter(e => e.type === 'combat.attack').length;

test('T-E32-18f interact next to the gun mounts, interact again leaves in one tick with the rocket launcher ready', async () => {
  const { w, gun } = await manned();
  equip(w, ['weapon.handgun'], ['weapon.rocket-launcher']);
  expect(gun.canMount()).toBe(true);
  press(w); expect(gun.mounted).toBe(true);
  expect(w.events.events().some(e => e.type === 'mounted-gun.mounted')).toBe(true);
  step(w, 5);
  const p = w.entities.get(1)!;
  expect(Math.hypot(p.transform.x - (0 - .78), p.transform.z - 4)).toBeLessThan(.05); // seat behind the pivot
  const before = w.tick; press(w);
  expect(gun.mounted).toBe(false); expect(w.tick - before).toBeLessThanOrEqual(30);
  const loadout = w.combat!.runner.loadout;
  expect(loadout.state.selectedSide).toBe('RIGHT'); expect(loadout.current('RIGHT').id).toBe('weapon.rocket-launcher');
  expect(loadout.usable('RIGHT', w.tick)).toBe(true);
  // Standing again: the player can walk off the gun.
  w.setInput({ move: { x: -1, z: 0 } }); step(w, 30); w.clearInput();
  expect(p.transform.x).toBeLessThan(-2.2);
});

test('T-E32-18g too far cannot mount; a deck gun lifts the gunner to the deck and a dismount stays on it', async () => {
  const { w, gun } = await manned();
  teleport(w, -6, 4); press(w); expect(gun.mounted).toBe(false);
  const deck = await manned(3); press(deck.w); expect(deck.gun.mounted).toBe(true);
  step(deck.w, 3); expect(deck.w.entities.get(1)!.transform.y).toBeCloseTo(3.7, 2);
  press(deck.w); expect(deck.gun.mounted).toBe(false);
});

test('T-E32-18h spin-up first, then an ordinary infected (40 HP) falls within 0.25 s of landed fire; no carried weapon fires', async () => {
  const { w, gun } = await manned();
  equip(w, ['weapon.handgun'], ['weapon.rocket-launcher']);
  const ids = [dummy(w, 12, 4, 40), dummy(w, 14, 4, 40)];
  press(w); trigger(w);
  const attacks: { tick: number; actionId: string }[] = [], kills: number[] = [];
  w.events.on('combat.attack', e => { if (e.type === 'combat.attack') attacks.push({ tick: e.tick, actionId: e.actionId }); });
  w.events.on('combat.kill', e => { if (e.type === 'combat.kill') kills.push(e.tick); });
  const start = w.tick;
  step(w, 60);
  expect(attacks[0].tick - start).toBeGreaterThanOrEqual(Math.floor(SPIN_S * 60) - 1); // the barrels spin up first
  expect(attacks.every(a => a.actionId === 'weapon.rotary-minigun')).toBe(true);
  expect(health(w, ids[0])).toBe(0);
  expect(kills[0] - attacks[0].tick).toBeLessThanOrEqual(15);
  expect(w.combat!.runner.running.LEFT).toBeUndefined(); expect(w.combat!.runner.running.RIGHT).toBeUndefined();
  expect(gun.heat).toBeGreaterThan(0);
});

test('T-E32-18i a regular Alpha (200 HP) falls to landed fire in at most 4 s, inside the heat budget', async () => {
  const { w, gun } = await manned();
  const id = w.spawnDummy('infected.alpha', { x: 15, z: 4 }, { hp: 200 }), e = w.entities.get(id)!;
  press(w); trigger(w);
  const start = w.tick;
  while (e.health.current > 0 && w.tick - start < 60 * 6) step(w, 1);
  expect(e.health.current).toBe(0);
  expect((w.tick - start) / 60 - SPIN_S).toBeLessThanOrEqual(4);
  expect(gun.locked).toBe(false);
});

test('T-E32-18j heat persists through dismount and remount, locks at 100%, a checkpoint restores it', async () => {
  const { w, gun } = await manned();
  press(w); trigger(w); step(w, 4 * 60); w.clearInput();
  const hot = gun.heat; expect(hot).toBeGreaterThan(.35);
  press(w); expect(gun.mounted).toBe(false);
  expect(gun.heat).toBeGreaterThanOrEqual(hot - 1e-9); // dismounting resets nothing
  const saved = captureSeams(w);
  press(w); expect(gun.mounted).toBe(true); expect(gun.heat).toBeGreaterThanOrEqual(hot - .03);
  trigger(w); for (let i = 0; i < 9 * 60 && !gun.locked; i++) step(w, 1);
  expect(gun.locked).toBe(true); expect(gun.heat).toBe(1);
  const rounds = count(w); step(w, 60);
  expect(count(w)).toBe(rounds);
  w.clearInput(); restoreSeams(w, saved);
  expect(gun.mounted).toBe(false); expect(gun.heat).toBeCloseTo(hot, 1); expect(gun.locked).toBe(false);
});

test('T-E32-18k choosing a weapon slot leaves the gun at once; dying drops the player off it', async () => {
  const { w, gun } = await manned();
  equip(w, ['weapon.handgun', 'weapon.bat'], ['weapon.rocket-launcher']);
  press(w); expect(gun.mounted).toBe(true);
  w.clearInput(); w.setInput({ selectedSlot: { side: 'LEFT', index: 1 } }); step(w, 1); w.clearInput();
  expect(gun.mounted).toBe(false);
  expect(w.combat!.runner.loadout.current('LEFT').id).toBe('weapon.bat');
  press(w); expect(gun.mounted).toBe(true);
  w.combat!.damage.god = false; w.player!.damage(1000, w.tick, true); step(w, 1);
  expect(gun.mounted).toBe(false);
});

test('T-E32-18l minigun-only against the Mega Alpha never takes it below 90%, whatever the heat cycles', async () => {
  const { w } = await manned();
  const id = w.spawnDummy('infected.alpha', { x: 10, z: 4 }, { hp: megaAlpha.hp }), e = w.entities.get(id)!;
  e.infected = { ...(e.infected ?? {}), pursuit: true, variant: megaAlpha.asset } as NonNullable<typeof e.infected>;
  e.combat!.radius = megaAlpha.radius;
  press(w); trigger(w); step(w, 40 * 60);
  expect(e.health.current).toBeGreaterThan(0);
  expect(e.health.current).toBeGreaterThanOrEqual(megaAlpha.hp * megaAlpha.conventionalFloor - 1e-6);
});
