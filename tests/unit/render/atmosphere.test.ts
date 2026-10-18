import { expect, test } from 'vitest';
import { Scene } from 'three/webgpu';
import { LookUniforms } from '../../../src/render/LookUniforms';
import { Lighting } from '../../../src/render/Lighting';
import { LampInsects } from '../../../src/render/AmbientLife';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { worldLook } from '../../../src/data/worldLook';
import type { PlacedLight } from '../../../src/data/placedLights';

test('@E25 atmosphere defaults rebase through campaign transitions and live edits retain uniform identity', () => {
  const look = new LookUniforms(), node = look.nodes.bloomStrength, sky = look.nodes.skyAmbient;
  look.setPreset(timeOfDay.L2.look!);
  expect(node.value).toBe(.18); expect(sky.value.getHexString()).toBe('b2d0ed');
  look.set({ version: 1, worldLook: { bloomStrength: .31 }, palette: {} });
  look.setPreset(timeOfDay['L6-subway'].look!);
  expect(look.nodes.bloomStrength).toBe(node); expect(node.value).toBe(.31);
  expect(sky.value.getHexString()).toBe('8fabc2');
  look.reset(); expect(node.value).toBe(.16);
  look.setPreset({}); expect(node.value).toBe(worldLook.bloomStrength);
  expect(sky.value.getHexString()).toBe(worldLook.skyAmbient.slice(1));
});

test('@E25 preset edits round trip without leaking into source data', () => {
  const look = new LookUniforms(); look.setPreset(timeOfDay.L1.look!);
  look.set({ version: 1, worldLook: { shadow: '#123456' }, palette: {} });
  const patch = look.export(), copy = new LookUniforms(); copy.set(patch);
  expect(copy.export()).toEqual(patch);
  look.reset(); expect(look.values.shadow).toBe(timeOfDay.L1.look!.shadow);
  expect(timeOfDay.L1.look!.shadow).toBe('#6c56ac');
});

test('@E25 atmosphere changes preserve night aura, road lift and exit continuity', () => {
  const lighting = new Lighting(new Scene());
  try {
    for (const preset of ['L6-subway', 'L6', 'L8-zoo', 'L9-crossing', 'L10-night'] as const) {
      lighting.set(preset);
      expect(lighting.heroFill.value).toBe(timeOfDay[preset].aura! * 3.2);
      expect(lighting.roadLift.value).toBe(timeOfDay[preset].roadLift ?? 0);
      expect(lighting.roadLiftColor.value.getHexString()).toBe((timeOfDay[preset].roadColor ?? '#86a8c0').slice(1));
      expect(lighting.rim.value).toBe(timeOfDay[preset].rim);
      expect(lighting.look.values.bloomStrength).toBe(timeOfDay[preset].look!.bloomStrength);
    }
    lighting.set('L6'); const exit = lighting.getState(); lighting.set('L6');
    expect(lighting.getState().fogColors).toEqual(exit.fogColors);
    lighting.set('night'); expect(lighting.look.values.bloomStrength).toBe(worldLook.bloomStrength);
  } finally { lighting.dispose(); }
});

test('@E25 lamp insects stay bounded, follow powered anchors and disappear on low/power-off', () => {
  const insects = new LampInsects();
  const lamp = { assetId: 'prop.street-lamp', position: [4, 3.18, 5], ground: 0 } as PlacedLight;
  try {
    insects.update(Array(20).fill(lamp), 1, true);
    expect(insects.visible).toBe(true); expect(insects.geometry.drawRange.count).toBe(72);
    insects.update([lamp], 2, false); expect(insects.visible).toBe(false);
    insects.update([], 3, true); expect(insects.visible).toBe(false);
    insects.update([{ ...lamp, assetId: 'veh.fire-engine' }], 3, true); expect(insects.visible).toBe(false);
  } finally { insects.dispose(); }
});
