import { describe, expect, it } from 'vitest';
import { infectedDefinitions } from '../../../src/data/infected';
import { registerCrowdModel } from '../../../src/render/crowdModels';

describe('registered crowd model aliases', () => {
  it('resolves every registered archetype and asset to one batch', () => {
    const aliases = new Map<string, string>();
    for (const def of infectedDefinitions) registerCrowdModel(aliases, def);
    for (const def of infectedDefinitions) expect(aliases.get(def.asset)).toBe(aliases.get(def.id));
    expect(aliases.get('inf.alpha')).toBe('inf.alpha');
    expect(aliases.get('inf.common-worker')).toBe('infected.runner');
  });
  it('keeps future animal registrations and arbitrary remapped assets addressable', () => {
    const aliases = new Map<string, string>();
    for (const name of ['zebra', 'elephant']) {
      const key = registerCrowdModel(aliases, { id: `infected.${name}`, asset: `inf.${name}` });
      expect(key).toBe(`inf.${name}`);
      expect(aliases.get(`infected.${name}`)).toBe(key);
      expect(aliases.get(`inf.${name}`)).toBe(key);
    }
    const key = registerCrowdModel(aliases, { id: 'infected.animal', asset: 'inf.custom-animal' });
    expect(aliases.get('inf.custom-animal')).toBe(key);
    expect(aliases.get('infected.animal')).toBe(key);
  });
});
