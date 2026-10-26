import { expect, test } from 'vitest';
import { emptyInput, type InputFrame } from '../../../src/input/InputFrame';
import type { AimAssistSetting } from '../../../src/sim/combat/AimAssist';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { arena } from './helpers';

// Q-196 (PO 10-26): "the heroine is shooting somewhere else, not to the Zombies. Like 45 degree to the other direction,
// although there is a Zombie in front of me." Keyboard fire runs the full resolve → loadout → attack pipeline here.
const rad = (degrees: number) => degrees * Math.PI / 180;
const degreesBetween = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) * 180 / Math.PI;

async function setup(setting: AimAssistSetting, weapon = 'weapon.army-mg') {
  const w = await arena(); w.combat!.setLoadout(['weapon.bat'], [weapon]); w.combat!.assist.setting = setting;
  w.entities.get(1)!.transform.yaw = 0;
  return w;
}
function place(w: SimWorld, yaw: number, offsetDegrees: number, distance: number, opts: { hp?: number; faction?: string } = {}): number {
  const p = w.entities.get(1)!.transform, angle = -yaw + rad(offsetDegrees);
  return w.spawnDummy('infected.dummy', { x: p.x + Math.cos(angle) * distance, z: p.z + Math.sin(angle) * distance }, { hp: opts.hp ?? 1e6, ...(opts.faction ? { faction: opts.faction } : {}) });
}
/** Holds RIGHT (K) with keyboard assist and returns the shot directions and the ids each shot hit. */
function burst(w: SimWorld, ticks: number, move = { x: 0, z: 0 }) {
  const start = w.events.events().length;
  for (let tick = 0; tick < ticks; tick++) {
    const frame: InputFrame = emptyInput(); frame.aimSource = 'assist'; frame.move = { ...move };
    frame.right = { down: tick === 0, held: true, up: false };
    w.applyInput(frame, 'keyboard'); w.update();
  }
  for (let tick = 0; tick < 15; tick++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); } // projectiles in flight land
  const events = w.events.events().slice(start);
  return {
    shots: events.flatMap(e => e.type === 'combat.attack' && e.sourceId === 1 ? [e.direction] : []),
    hits: events.flatMap(e => e.type === 'combat.hit' && e.sourceId === 1 ? [e.targetId] : []),
  };
}

for (const yaw of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4]) {
  test(`Q-196 @E05-AC11 assist Off: idle keyboard MG fire leaves along the facing at yaw ${(yaw * 180 / Math.PI).toFixed(0)}°`, async () => {
    const w = await setup('Off'); w.entities.get(1)!.transform.yaw = yaw;
    for (const [offset, distance] of [[30, 4], [-30, 6], [60, 3], [-60, 10]] as const) place(w, yaw, offset, distance);
    const facing = { x: Math.cos(yaw), z: -Math.sin(yaw) }, { shots } = burst(w, 60);
    expect(shots.length).toBeGreaterThanOrEqual(8);
    for (const shot of shots) expect(degreesBetween(shot, facing)).toBeLessThan(3);
  });
  test(`Q-196 @E05-AC11 assist Default: idle keyboard MG fire snaps onto the zombie in front at yaw ${(yaw * 180 / Math.PI).toFixed(0)}°`, async () => {
    const w = await setup('Default'); w.entities.get(1)!.transform.yaw = yaw;
    const front = place(w, yaw, 12, 9);
    for (const [offset, distance] of [[60, 3], [-60, 4], [90, 2]] as const) place(w, yaw, offset, distance);
    const { shots, hits } = burst(w, 60);
    expect(shots.length).toBeGreaterThanOrEqual(8);
    expect(hits.filter(id => id === front).length / shots.length).toBeGreaterThanOrEqual(.9);
  });
}

test('Q-196 keyboard assist picks the zombie closest to the aim ray, the nearer one when aligned, within 25° and 18 m', async () => {
  const w = await setup('Default'), assist = w.combat!.assist, origin = { ...w.entities.get(1)!.transform };
  const aimAt = (id: number) => { const t = w.entities.get(id)!.transform, d = Math.hypot(t.x - origin.x, t.z - origin.z); return { x: (t.x - origin.x) / d, z: (t.z - origin.z) / d }; };
  const side = place(w, 0, 20, 3), ahead = place(w, 0, 2, 7);
  let aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, aimAt(ahead))).toBeLessThan(.01); // not the nearer one 20° off
  const nearer = place(w, 0, -1, 4);
  aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, aimAt(nearer))).toBeLessThan(.01);
  for (const id of [ahead, nearer]) w.entities.get(id)!.health.current = 0; // corpses never pull
  aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, aimAt(side))).toBeLessThan(.01);
  w.entities.get(side)!.health.current = 0;
  place(w, 0, 30, 5); place(w, 0, 0, 19); // outside the cone / beyond 18 m
  place(w, 0, 0, 5, { faction: 'civilian' }); place(w, 0, 3, 6, { faction: 'escort' });
  aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(aim).toEqual({ x: 1, z: 0 });
  w.combat!.assist.setting = 'High'; aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, { x: 1, z: 0 })).toBeCloseTo(30, 1);
});

test('Q-196 an idle burst keeps its starting facing: the turning courier never walks the cone to the next zombie', async () => {
  const w = await setup('Default');
  const first = place(w, 0, 18, 9);
  const lure = place(w, 0, 40, 4); // 22° from the first target, nearer: the old yaw-centred cone drifted onto it
  const { hits, shots } = burst(w, 90);
  expect(shots.length).toBeGreaterThanOrEqual(12);
  expect(hits.filter(id => id === first).length).toBeGreaterThanOrEqual(10);
  expect(hits).not.toContain(lure);
});

test('Q-196 moving keyboard fire aims along the movement and snaps inside it', async () => {
  const w = await setup('Default');
  const target = place(w, 0, 80, 8); // 10° off the +z movement
  const { hits, shots } = burst(w, 45, { x: 0, z: 1 });
  expect(shots.length).toBeGreaterThanOrEqual(5);
  expect(hits.filter(id => id === target).length / shots.length).toBeGreaterThanOrEqual(.9);
});

test('Q-196 keyboard rocket assist leads a walking zombie', async () => {
  const w = await setup('Default', 'weapon.rocket-launcher');
  const id = place(w, 0, 0, 12), zombie = w.entities.get(id)!;
  zombie.motion = { ...(zombie.motion ?? {}), velocity: { x: 0, y: 0, z: 2 } } as typeof zombie.motion;
  const origin = { ...w.entities.get(1)!.transform }, aim = { x: 1, z: 0 };
  w.combat!.assist.facing(origin, aim, 35, 18);
  expect(aim.z).toBeGreaterThan(.05); // aims ahead of the body along its walk
  const time = 12 / 18, expected = Math.atan2(2 * time, 12) * 180 / Math.PI;
  expect(Math.atan2(aim.z, aim.x) * 180 / Math.PI).toBeCloseTo(expected, 0);
});
