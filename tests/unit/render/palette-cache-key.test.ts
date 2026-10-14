import { expect, test } from 'vitest';
import { MeshLambertNodeMaterial, Scene } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { weatherMaterialFlags } from '../../../src/render/WeatherView';

test('palette keys match Three through weather, direct node replacement, added nodes and frozen copies', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const material = materials.get('sidewalk');
  const reference = MeshLambertNodeMaterial.prototype.customProgramCacheKey;
  const check = () => expect(material.customProgramCacheKey()).toBe(reference.call(material));
  try {
    check(); check();
    material.fade.value = .3; check();
    material.setWeatherMode(weatherMaterialFlags.fog | weatherMaterialFlags.wet); check();
    // NodeMaterial supports direct assignment even without needsUpdate.
    material.positionNode = vec3(1, 2, 3); check();
    material.positionNode = null; check();
    Object.defineProperty(material, 'extraNode', { value: float(.5), configurable: true }); check();
    delete (material as unknown as Record<string, unknown>).extraNode; check();
    const copy = material.frozenCopy();
    expect(copy.customProgramCacheKey()).toBe(reference.call(copy)); copy.dispose();
  } finally { materials.dispose(); lighting.dispose(); }
});

test('palette uniforms share a render group within each material without sharing values across materials', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  try {
    const first = materials.get('sidewalk'), second = materials.get('asphalt');
    const group = first.fade.groupNode;
    expect(group.shared).toBe(true); expect(group.updateType).toBe('render');
    for (const node of [first.emissivePower, first.bloodCoverage, first.hitFlash, first.char, first.figureRim, first.movingFigure]) expect(node.groupNode).toBe(group);
    expect(second.fade.groupNode).not.toBe(group);
    first.fade.value = .2; expect(second.fade.value).toBe(1);
    const copy = first.frozenCopy();
    expect(copy.fade.groupNode.shared).toBe(true); expect(copy.fade.groupNode.updateType).toBe('render');
    first.setWeatherMode(weatherMaterialFlags.fog); copy.setWeatherMode(weatherMaterialFlags.fog);
    expect(copy.fade.value).toBe(first.fade.value); copy.dispose();
  } finally { materials.dispose(); lighting.dispose(); }
});
