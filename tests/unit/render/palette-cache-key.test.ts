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
