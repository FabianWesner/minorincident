import { expect, test } from 'vitest';
import { Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { weatherMaterialFlags } from '../../../src/render/WeatherView';

test('T-E22-20-reveal-cache @E22-AC20 @E18-AC05 reveal and weather transitions reuse their exact shader graphs', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), material = materials.get('sidewalk');
  const modes = [0, weatherMaterialFlags.fog, weatherMaterialFlags.fog | weatherMaterialFlags.wet];
  const features = [false, true, 'placement', 'boss'] as const;
  const graphs = new Map<string, { node: unknown; key: string }>();
  for (const mode of modes) for (const feature of features) {
    material.seeThrough(feature); material.setWeatherMode(mode);
    graphs.set(`${mode}:${feature}`, { node: material.outputNode, key: material.customProgramCacheKey() });
  }
  expect(new Set([...graphs.values()].map(g => g.node)).size).toBe(modes.length * features.length);
  for (let loop = 0; loop < 4; loop++) for (const mode of [...modes].reverse()) for (const feature of [...features].reverse()) {
    material.seeThrough(feature); material.setWeatherMode(mode);
    expect(material.outputNode).toBe(graphs.get(`${mode}:${feature}`)!.node);
    expect(material.customProgramCacheKey()).toBe(graphs.get(`${mode}:${feature}`)!.key);
  }
  const copy = material.frozenCopy(); copy.seeThrough(true); copy.setWeatherMode(0);
  expect(copy.outputNode).toBe(graphs.get('0:true')!.node);
  expect(material.outputNode).toBe(graphs.get('0:false')!.node);
  expect(material.userData.seeThrough).toBe(false);
  material.seeThrough(true); material.setWeatherMode(0);
  expect(material.outputNode).toBe(graphs.get('0:true')!.node);
  copy.dispose(); materials.dispose(); lighting.dispose();
});
