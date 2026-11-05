// Aim assist runs for every ranged weapon with mouse, keyboard and touch. Q-196 (PO 10-26): "the heroine is shooting
// somewhere else, not to the Zombies. Like 45 degree to the other direction, although there is a Zombie in front of me."
import { afterEach, expect, test } from 'vitest';
import { emptyInput, type InputFrame } from '../../src/input/InputFrame';
import type { AimAssistSetting } from '../../src/sim/combat/AimAssist';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
const rad = (degrees: number) => degrees * Math.PI / 180;
const degreesBetween = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) * 180 / Math.PI;
async function setup(setting: AimAssistSetting, weapon = 'weapon.army-mg') {
  const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('combat-arena', 1);
  w.combat!.setLoadout(['weapon.bat'], [weapon]); w.combat!.assist.setting = setting;
  w.entities.get(1)!.transform.yaw = 0;
  return w;
}
function place(w: SimWorld, yaw: number, offsetDegrees: number, distance: number, opts: { hp?: number; faction?: string } = {}): number {
  const p = w.entities.get(1)!.transform, angle = -yaw + rad(offsetDegrees);
  return w.spawnDummy('infected.dummy', { x: p.x + Math.cos(angle) * distance, z: p.z + Math.sin(angle) * distance }, { hp: opts.hp ?? 1e6, ...(opts.faction ? { faction: opts.faction } : {}) });
}
/** Holds RIGHT (K) with keyboard assist; returns shot directions and the ids each shot hit. */
function burst(w: SimWorld, ticks: number, move = { x: 0, z: 0 }) {
  const start = w.events.events().length;
  for (let tick = 0; tick < ticks; tick++) {
    const frame: InputFrame = emptyInput(); frame.aimSource = 'assist'; frame.move = { ...move };
    frame.right = { down: tick === 0, held: true, up: false };
    w.applyInput(frame, 'keyboard'); w.update();
  }
  for (let tick = 0; tick < 15; tick++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); }
  const events = w.events.events().slice(start);
  return {
    shots: events.flatMap(e => e.type === 'combat.attack' && e.sourceId === 1 ? [e.direction] : []),
    hits: events.flatMap(e => e.type === 'combat.hit' && e.sourceId === 1 ? [e.targetId] : []),
  };
}

test('keyboard fire at all eight facings: Off shoots along the facing, Default lands on the zombie in front', async () => {
  for (const yaw of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4]) {
    const label = `yaw ${(yaw * 180 / Math.PI).toFixed(0)}°`;
    const off = await setup('Off'); off.entities.get(1)!.transform.yaw = yaw;
    for (const [offset, distance] of [[30, 4], [-30, 6], [60, 3], [-60, 10]] as const) place(off, yaw, offset, distance);
    const facing = { x: Math.cos(yaw), z: -Math.sin(yaw) }, idle = burst(off, 60);
    expect(idle.shots.length, label).toBeGreaterThanOrEqual(8);
    for (const shot of idle.shots) expect(degreesBetween(shot, facing), label).toBeLessThan(3);

    const on = await setup('Default'); on.entities.get(1)!.transform.yaw = yaw;
    const front = place(on, yaw, 12, 9);
    for (const [offset, distance] of [[60, 3], [-60, 4], [90, 2]] as const) place(on, yaw, offset, distance);
    const assisted = burst(on, 60);
    expect(assisted.hits.filter(id => id === front).length / assisted.shots.length, label).toBeGreaterThanOrEqual(.9);
  }
});

test('target choice: closest to the aim ray within 25° and 18 m, nearer when aligned; never corpses, civilians or escorts; pointer snap 8° not 15°', async () => {
  const w = await setup('Default'), assist = w.combat!.assist, origin = { ...w.entities.get(1)!.transform };
  const aimAt = (id: number) => { const t = w.entities.get(id)!.transform, d = Math.hypot(t.x - origin.x, t.z - origin.z); return { x: (t.x - origin.x) / d, z: (t.z - origin.z) / d }; };
  const side = place(w, 0, 20, 3), ahead = place(w, 0, 2, 7);
  let aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, aimAt(ahead))).toBeLessThan(.01);
  const nearer = place(w, 0, -1, 4);
  aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, aimAt(nearer))).toBeLessThan(.01);
  for (const id of [ahead, nearer]) w.entities.get(id)!.health.current = 0;
  aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(degreesBetween(aim, aimAt(side))).toBeLessThan(.01);
  w.entities.get(side)!.health.current = 0;
  place(w, 0, 30, 5); place(w, 0, 0, 19); place(w, 0, 0, 5, { faction: 'civilian' }); place(w, 0, 3, 6, { faction: 'escort' });
  aim = { x: 1, z: 0 }; assist.facing(origin, aim, 40);
  expect(aim).toEqual({ x: 1, z: 0 });

  // Pointer aim: Default snaps an 8° target, not a 15° one; Off never snaps; the stored side aim is untouched.
  for (const [angle, setting, hit] of [[8, 'Default', true], [15, 'Default', false], [8, 'Off', false]] as const) {
    const p = await setup(setting, 'weapon.pistol'); p.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']);
    const id = p.spawnDummy('infected.dummy', { x: 8 * Math.cos(rad(angle)), z: 8 * Math.sin(rad(angle)) }, { hp: 100 });
    p.clearInput(); p.setInput({ aim: { x: 1, z: 0 }, left: { down: true, held: true, up: false } }); p.update(); p.clearInput();
    for (let i = 0; i < 10; i++) p.update();
    expect(p.entities.get(id)!.health.current, `${setting} ${angle}°`).toBe(hit ? 80 : 100);
    expect(p.entities.get(1)!.weapons!.LEFT.aim).toEqual({ x: 1, z: 0 });
  }
});

test('an idle burst keeps its starting facing, moving fire aims along the walk, and the rocket leads a walking zombie', async () => {
  const w = await setup('Default');
  const first = place(w, 0, 18, 9), lure = place(w, 0, 40, 4);
  const idle = burst(w, 90);
  expect(idle.hits.filter(id => id === first).length).toBeGreaterThanOrEqual(10);
  expect(idle.hits).not.toContain(lure);

  const m = await setup('Default'), target = place(m, 0, 80, 8);
  const moving = burst(m, 45, { x: 0, z: 1 });
  expect(moving.hits.filter(id => id === target).length / moving.shots.length).toBeGreaterThanOrEqual(.9);

  const r = await setup('Default', 'weapon.rocket-launcher');
  const zombie = r.entities.get(place(r, 0, 0, 12))!;
  zombie.motion = { ...(zombie.motion ?? {}), velocity: { x: 0, y: 0, z: 2 } } as typeof zombie.motion;
  const aim = { x: 1, z: 0 };
  r.combat!.assist.facing({ ...r.entities.get(1)!.transform }, aim, 35, 18);
  expect(Math.atan2(aim.z, aim.x) * 180 / Math.PI).toBeCloseTo(Math.atan2(2 * 12 / 18, 12) * 180 / Math.PI, 0);
});
