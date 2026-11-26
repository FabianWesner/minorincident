import { describe, expect, it } from 'vitest';
import { carriedWeapons } from '../../src/ui/Onboarding';

const rack = (...ids: string[]) => ({ rack: ids.map(id => ({ id })) });

describe('onboarding switch-weapon hint', () => {
  it('counts one weapon when the other rack only holds the lure, kick or fists', () => {
    expect(carriedWeapons({ LEFT: rack('weapon.bat'), RIGHT: rack('ability.corgi-lure', 'weapon.kick') })).toBe(1);
    expect(carriedWeapons({ LEFT: rack('weapon.bat'), RIGHT: rack('weapon.bat') })).toBe(1);
    expect(carriedWeapons(undefined)).toBe(0);
  });
  it('counts two distinct weapons', () => {
    expect(carriedWeapons({ LEFT: rack('weapon.bat'), RIGHT: rack('weapon.pistol', 'ability.corgi-lure') })).toBe(2);
  });
});
