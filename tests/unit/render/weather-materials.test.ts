import { describe, expect, it } from 'vitest';
import { DataTexture, Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import { weatherMaterialFlags } from '../../../src/render/WeatherView';

describe('weather surface graphs', () => {
  it('@E28 cached graphs keep see-through and frozen corpses following weather after the source is disposed', () => {
    const lighting = new Lighting(new Scene()); lighting.set('L2'); lighting.setWeatherMode(0);
    const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const source = new PaletteMaterial('asphalt', texture, lighting).seeThrough();
    const frozen = source.frozenCopy(), clear = source.outputNode, frozenClear = frozen.outputNode;
    expect(frozen.userData.seeThrough).toBe(true);
    lighting.setWeatherMode(weatherMaterialFlags.accumulation);
    expect(source.outputNode).not.toBe(clear); expect(frozen.outputNode).not.toBe(frozenClear);
    lighting.setWeatherMode(0);
    expect(source.outputNode).toBe(clear); expect(frozen.outputNode).toBe(frozenClear);
    source.dispose();
    expect(lighting.paletteMaterials.has(source)).toBe(false);
    expect(lighting.paletteMaterials.has(frozen)).toBe(true);
    lighting.setWeatherMode(weatherMaterialFlags.fog);
    expect(frozen.outputNode).not.toBe(frozenClear);
    frozen.dispose();
    expect(lighting.paletteMaterials.size).toBe(0);
    texture.dispose(); lighting.field.dispose();
  });
});
