import { expect, test } from 'vitest';
import { action } from '../../../src/data/actions/catalog';
import { explosionDef, validateExplosions } from '../../../src/data/explosions';
import { equipL7Arsenal, spawnL7Rocket } from '../../../src/levels/L7/rocket';
import { downed } from '../../../src/sim/combat/Damage';
import { arena, equip, fire, step } from './helpers';

async function rocket() {
  const w = await arena(); w.loadScenario('horde-arena'); w.scenario = 'L7'; w.combat!.damage.god = true;
  w.combat!.assist.setting = 'Off'; equip(w, ['weapon.rocket-launcher']);
  return w;
}
function frozen(w: Awaited<ReturnType<typeof arena>>, x: number, z: number, alpha = false) {
  const id = w.infected!.spawn(alpha ? 'infected.alpha' : 'infected.runner', { x, z });
  const e = w.entities.get(id)!;
  e.emerging = true; // Hold AI movement before impact; physical footprints remain active.
  e.infected!.until = Number.MAX_SAFE_INTEGER; e.combat!.staggerUntil = Number.MAX_SAFE_INTEGER;
  return e;
}

test('T-E29-04 @E29-AC04 exit-relative pickup retains all five previous weapons, equips once after 0.6s / E', async () => {
  for (const distance of [.4, 1.2]) {
    const w = await arena(); equipL7Arsenal(w);
    const before = w.combat!.runner.loadout.activeEntries().map(e => e.id);
    expect(before).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun']));
    const id = spawnL7Rocket(w, { x: -3 + distance, z: 0 });
    expect(Math.hypot(w.entities.get(id)!.transform.x - (-3 + distance), w.entities.get(id)!.transform.z)).toBe(3);
    expect(spawnL7Rocket(w, { x: -3 + distance, z: 0 })).toBe(id);
    if (distance > .6) { step(w, 40); expect(w.entities.get(id)).toBeDefined(); w.setInput({ interact: true }); }
    step(w, 35); expect(w.entities.get(id)).toBeDefined();
    step(w, 1); w.clearInput(); expect(w.entities.get(id)).toBeUndefined();
    expect(w.combat!.runner.loadout.current('RIGHT').id).toBe('weapon.rocket-launcher');
    expect(w.combat!.runner.loadout.activeEntries().map(e => e.id)).toEqual(expect.arrayContaining(before));
    expect(spawnL7Rocket(w, { x: 0, z: 0 })).toBe(0);
    step(w, 60); expect(w.events.events().filter(e => e.type === 'pickup.collected')).toHaveLength(1);
  }
  const w = await arena(), owned = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.smg', 'weapon.hunting-rifle'];
  equipL7Arsenal(w, owned); expect(w.combat!.runner.loadout.activeEntries().map(e => e.id)).toEqual(expect.arrayContaining(owned));
});

test('T-E29-05 @E29-AC05 600 rockets have no reload/empty/charges and exactly 75 tick cadence', async () => {
  const w = await rocket(), ticks: number[] = [];
  w.events.on('combat.attack', e => { if (e.type === 'combat.attack') ticks.push(e.tick); });
  w.setInput({ aim: { x: 1, z: 0 }, left: { down: false, held: true, up: false } });
  step(w, 600 * 75);
  expect(ticks).toHaveLength(600); expect(ticks.slice(1).every((t, i) => t - ticks[i] === 75)).toBe(true);
  expect(action('weapon.rocket-launcher')).toMatchObject({ magazine: 0, reloadTime: 0, charges: 0, fireRate: .8 });
  expect(w.combat!.runner.loadout.current('LEFT')).toMatchObject({ magazine: 0, reloadUntil: 0, charges: 0, nextCharge: 0 });
});

for (const count of [24, 200]) test(`T-E29-06-${count} @E29-AC06 one real projectile permanently clears ${count} infected in its blast tick`, async () => {
  const w = await rocket(); w.infected!.director.levelCap = 200;
  // Twenty-four full bodies fit in the blast's forward half-disk, without the
  // old overlapping ring. The 200-body packing precondition remains explicit.
  const targets = count === 24 ? Array.from({ length: count }, (_, i) => {
    const row = i % 7, z = row ? Math.ceil(row / 2) * .7 * (row % 2 ? -1 : 1) : 0;
    return frozen(w, 8 + Math.floor(i / 7) * .7, z);
  }) : [frozen(w, 8, 0), ...Array.from({ length: count - 1 }, (_, i) => {
    const angle = i * 2 * Math.PI / (count - 1); return frozen(w, 9.5 + Math.cos(angle) * 1.4, Math.sin(angle) * 1.4);
  })];
  if (count === 24) {
    expect(w.solids.snapshot().pending).toBe(0);
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++)
      expect(Math.hypot(targets[i].transform.x - targets[j].transform.x, targets[i].transform.z - targets[j].transform.z)).toBeGreaterThanOrEqual(.68);
  }
  expect(targets.every(e => e.health.current === 60)).toBe(true);
  const positions = targets.map(e => ({ x: e.transform.x, z: e.transform.z }));
  fire(w); for (let i = 0; i < 80 && !w.explosions!.last; i++) step(w, 1);
  const blast = w.explosions!.last!; expect(blast).toMatchObject({ id: 'explosion.rocket', radius: 6 });
  expect(positions.every(e => Math.hypot(e.x - blast.x, e.z - blast.z) <= 3)).toBe(true);
  expect(targets.filter(e => e.health.current === 0 && !downed(e))).toHaveLength(count);
  const kills = w.events.events().filter(e => e.type === 'combat.kill');
  expect(kills).toHaveLength(count); expect(kills.every(e => e.tick === blast.tick)).toBe(true);
  expect(w.events.events().filter(e => e.type === 'explosion')).toHaveLength(1);
  step(w, 21 * 60); expect(targets.every(e => !w.entities.get(e.id) || e.health.current === 0)).toBe(true);
  // The 3m corridor contains no living/dynamically collidable infected; corpse recovery cannot close it.
  expect(w.combat!.query.splash({ x: blast.x, z: blast.z }, 3)).toHaveLength(0);
  validateExplosions(); expect(explosionDef('explosion.rocket')).toMatchObject({ radius: action('weapon.rocket-launcher').splash!.radius, damage: 180, falloff: .6 });
});

test('T-E29-06-los @E29-AC06 E27 full cover shields a crowd member from a real rocket', async () => {
  const w = await rocket(); frozen(w, 8, 0); const behind = frozen(w, 10, 0);
  const walls = w.combat!.query.walls as { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }[];
  walls.push({ x: 9, y: 1, z: 0, halfX: .1, halfY: 1, halfZ: 2 });
  fire(w); step(w, 60); expect(behind.health.current).toBe(60);
});

test('T-E29-07-rocket @E29-AC07 shared Alpha takes two center rocket blasts', async () => {
  const w = await rocket(), alpha = frozen(w, 8, 0, true);
  fire(w); step(w, 40); expect(alpha.health.current).toBe(120);
  step(w, 75); fire(w); step(w, 40); expect(alpha.health.current).toBe(0); expect(downed(alpha)).toBe(false);
});

test('T-E29-06-200-solid-ring @E29-AC06 one real rocket clears 200 admitted full footprints inside its unchanged blast', async () => {
  const w = await rocket(); w.infected!.director.levelCap = 200;
  const candidates: { x: number; z: number }[] = [];
  for (let row = -9; row <= 9; row++) for (let col = -9; col <= 9; col++) {
    const x = .5 + col * .72 + Math.abs(row) % 2 * .36, z = row * .72 * Math.sqrt(3) / 2;
    if (Math.hypot(x - .5, z) <= 5.5 && Math.hypot(x, z) >= .9) candidates.push({ x, z });
  }
  candidates.sort((a, b) => Math.hypot(a.x - .8, a.z) - Math.hypot(b.x - .8, b.z));
  expect(candidates.length).toBeGreaterThanOrEqual(200);
  const targets = candidates.slice(0, 200).map(p => frozen(w, p.x, p.z));
  w.solids.commit();
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  expect(targets.every(e => !e.hidden && e.health.current === 60)).toBe(true);
  expect(w.infected!.director.count).toBe(200);
  const positions = targets.map(e => ({ ...e.transform }));
  fire(w); for (let i = 0; i < 80 && !w.explosions!.last; i++) step(w, 1);
  const blast = w.explosions!.last!;
  expect(blast).toMatchObject({ id: 'explosion.rocket', radius: 6 });
  expect(positions.every(p => Math.hypot(p.x - blast.x, p.z - blast.z) <= 6)).toBe(true);
  expect(targets.filter(e => e.health.current === 0 && !downed(e))).toHaveLength(200);
  const kills = w.events.events().filter(e => e.type === 'combat.kill');
  expect(kills).toHaveLength(200); expect(kills.every(e => e.tick === blast.tick)).toBe(true);
  expect(w.events.events().filter(e => e.type === 'explosion')).toHaveLength(1);
  step(w, 21 * 60); expect(targets.every(e => !w.entities.get(e.id) || e.health.current === 0)).toBe(true);
  expect(w.combat!.query.splash({ x: blast.x, z: blast.z }, 6).filter(e => e.kind === 'infected')).toHaveLength(0);
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
  expect(explosionDef('explosion.rocket')).toMatchObject({ radius: 6, damage: 180, falloff: .6 });
});
