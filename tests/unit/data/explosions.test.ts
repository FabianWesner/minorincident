import { expect, test } from 'vitest';
import { actionExplosions, blastClasses, blastFxPresets, explosionDefs, hazardExplosions, scriptedExplosions, validateExplosions, vehicleExplosion } from '../../../src/data/explosions';
import { catalog } from '../../../src/data/actions/catalog';

test('T-E27-01 @E27 @E27-AC01 every ExplosionDef and BlastFxPreset validates and every explosive source references one', () => {
  expect(() => validateExplosions()).not.toThrow();
  for (const d of Object.values(explosionDefs)) { expect(blastClasses).toContain(d.class); expect(blastFxPresets[d.fx], d.id).toBeDefined(); }
  // Explosive E11 hazards, explosive throwables/projectiles, vehicles and scripted mega blasts.
  for (const id of ['propane', 'barrel']) expect(explosionDefs[hazardExplosions[id]]).toBeDefined();
  const explosive = Object.values(catalog).filter(a => a.splash && a.damage > 0 && (a.category === 'throwable' || a.projectile)).map(a => a.id);
  expect(explosive.sort()).toEqual(Object.keys(actionExplosions).sort());
  expect(explosionDefs[vehicleExplosion].class).toBe('large');
  for (const id of scriptedExplosions) expect(explosionDefs[id].stages!.map(s => explosionDefs[s.def].class)).toEqual(['large', 'large', 'mega']);
  // The validator rejects broken data.
  const broken = (patch: object) => () => validateExplosions({ ...explosionDefs, 'explosion.propane': { ...explosionDefs['explosion.propane'], ...patch } });
  expect(broken({ fx: 'blast.none' })).toThrow('missing preset');
  expect(broken({ falloff: 2 })).toThrow('curve');
  expect(broken({ chainDelay: 40 })).toThrow('response');
  expect(() => validateExplosions({ ...explosionDefs, 'explosion.gas-station': { ...explosionDefs['explosion.gas-station'], stages: [{ delay: 0, offset: { x: 0, z: 0 }, def: 'explosion.nope' }] } })).toThrow('stage');
  expect(() => validateExplosions({ ...explosionDefs, 'explosion.grenade': { ...explosionDefs['explosion.grenade'], radius: 9 } })).toThrow('diverges');
});
