import { expect, test } from 'vitest';
import { catalog, action } from '../../../src/data/actions/catalog';
import { validateAction } from '../../../src/data/actions/schema';
const roster = ['weapon.fists', 'weapon.kick', 'weapon.bat', 'weapon.crowbar', 'weapon.machete', 'weapon.knife', 'weapon.nail-bat', 'weapon.shovel', 'weapon.police-baton', 'weapon.fire-axe', 'weapon.katana', 'weapon.pistol', 'weapon.shotgun', 'weapon.nail-gun', 'weapon.smg', 'weapon.hunting-rifle', 'weapon.assault-rifle', 'weapon.machine-gun', 'weapon.rocket-launcher', 'weapon.grenade', 'weapon.molotov', 'weapon.pipe-bomb', 'weapon.firecracker-lure', 'weapon.smoke-grenade', 'weapon.flashbang', 'ability.corgi-lure', 'ability.ground-slam', 'ability.shield-bubble', 'ability.adrenaline', 'ability.turret'];
test('T-E06-01 @E06 @E06-AC01 full milestone roster validates at boot', () => {
  expect(Object.keys(catalog).sort()).toEqual(roster.sort());
  for (const def of Object.values(catalog)) { expect(validateAction(def)).toBe(def); expect(action(def.id)).toBe(def); }
  expect(() => action('invalid')).toThrow();
});
test('T-E06-01b @E06 @E06-AC01 rejects missing fields and malformed catalog extensions', () => {
  const base = action('weapon.shotgun');
  for (const key of Object.keys(base).filter((key) => !['effect', 'pellets', 'distanceFalloff'].includes(key))) { const def = { ...base }; delete def[key as keyof typeof def]; expect(() => validateAction(def), key).toThrow(); }
  for (const patch of [{ pellets: 0 }, { distanceFalloff: { start: 12, end: 3, minimum: 0.1 } }, { effect: { kind: 'fire', radius: -1, duration: 6 } }]) expect(() => validateAction({ ...base, ...patch } as typeof base)).toThrow();
});

test('T-E06-01c @E06 @E06-AC01 tuning survives schema limits at all tiers', () => {
  for (const def of Object.values(catalog)) {
    expect(def.range).toBeLessThanOrEqual(40); expect(def.damage).toBeLessThanOrEqual(200); expect(def.tier).toBeLessThanOrEqual(2);
    expect(def.windup + def.active + def.recovery).toBeLessThanOrEqual(1.5); expect(def.upgradeHooks.length).toBeGreaterThan(0);
  }
});
