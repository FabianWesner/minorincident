import { describe, expect, it } from 'vitest';
import { worldLook } from '../../../src/data/worldLook';
import { palette } from '../../../src/data/palette';
import { exportLookPatch, validateLookPatch } from '../../../src/data/lookPatch';
import { LookUniforms } from '../../../src/render/LookUniforms';

describe('lookdev export patch', () => {
  it('exports only edited tokens and round-trips through JSON', () => {
    const baselineSun = worldLook.sun, baselineWood = palette.woodWarm;
    const repeats = Number(worldLook.dofRepeats) === 16 ? 8 : 16;
    const values = { ...worldLook, sun: '#ffcc88', dofRepeats: repeats };
    const colours = { ...palette, woodWarm: '#cc9955' };
    const patch = exportLookPatch(values, colours);
    expect(patch).toEqual({ version: 1, worldLook: { sun: '#ffcc88', dofRepeats: repeats }, palette: { woodWarm: '#cc9955' } });
    expect(validateLookPatch(JSON.parse(JSON.stringify(patch)))).toEqual(patch);
    expect(worldLook.sun).toBe(baselineSun); expect(palette.woodWarm).toBe(baselineWood);
    expect(exportLookPatch({ ...worldLook }, { ...palette })).toEqual({ version: 1, worldLook: {}, palette: {} });
  });
  it.each([
    { version: 2, worldLook: {}, palette: {} },
    { version: 1, worldLook: { unknown: 1 }, palette: {} },
    { version: 1, worldLook: {}, palette: { unknown: '#ffffff' } },
    { version: 1, worldLook: { sun: 'red' }, palette: {} },
    { version: 1, worldLook: { sunIntensity: Infinity }, palette: {} },
    { version: 1, worldLook: { dofRepeats: 1.5 }, palette: {} },
    { version: 1, worldLook: { grassHeight: .7 }, palette: {} },
    { version: 1, worldLook: { dofStart: .4, dofEnd: .3 }, palette: {} },
    { version: 1, worldLook: { fogNear: 200, fogFar: 100 }, palette: {} },
    { version: 1, worldLook: { fogRatioA: .8, fogRatioB: .4 }, palette: {} },
    { version: 1, worldLook: {}, palette: {}, extra: true },
  ])('rejects invalid patch %j', patch => { expect(() => validateLookPatch(patch)).toThrow(); });
  it('updates existing uniform identities and rejects a delta crossing a previous live edge atomically', () => {
    const look = new LookUniforms(), node = look.nodes.sun, fog = look.nodes.fogRatioA;
    look.set({ version: 1, worldLook: { sun: '#ffaa66', fogRatioA: .6 }, palette: {} });
    expect(look.nodes.sun).toBe(node); expect(node.value.getHexString()).toBe('ffaa66'); expect(fog.value).toBe(.6);
    expect(() => look.set({ version: 1, worldLook: { fogRatioB: .5, sunIntensity: 2 }, palette: {} })).toThrow();
    expect(look.values.sunIntensity).toBe(worldLook.sunIntensity);
    look.reset(); expect(look.nodes.sun).toBe(node); expect(node.value.getHexString()).toBe(worldLook.sun.slice(1));
    expect(look.export()).toEqual({ version: 1, worldLook: {}, palette: {} });
  });
});
