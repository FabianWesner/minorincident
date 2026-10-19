import { expect, test } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import type { View } from '../../../src/render/View';
import { validateLookPatch } from '../../../src/data/lookPatch';
import { LookUniforms } from '../../../src/render/LookUniforms';
import { Lighting } from '../../../src/render/Lighting';
import { LampInsects } from '../../../src/render/AmbientLife';
import { timeOfDay } from '../../../src/data/timeOfDay';
import { cameraFraming } from '../../../src/data/cameraFraming';
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

const campaign = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6-subway', 'L6', 'L8-zoo', 'L9-crossing', 'L10-night'] as const;

test('@E25 atmosphere 2: neutral defaults, so non-campaign presets and lookdev keep the old image', () => {
  expect(worldLook.gradeAmount).toBe(0); expect(worldLook.hazeAmount).toBe(0); expect(worldLook.cloudShadow).toBe(0); expect(worldLook.beamStrength).toBe(1);
  for (const preset of ['golden', 'night'] as const) expect(timeOfDay[preset].look).toBeUndefined();
  expect(() => validateLookPatch({ version: 1, worldLook: { hazeStart: 2, hazeEnd: 1.5 }, palette: {} })).toThrow(/ordered/);
  expect(() => validateLookPatch({ version: 1, worldLook: { gradeAmount: 1.5 }, palette: {} })).toThrow(/gradeAmount/);
});

test('@E25 atmosphere 2: every campaign level has its own grade, haze and visible ambient life; clouds only by day', () => {
  const signatures = new Set<string>();
  for (const preset of campaign) {
    const look = { ...worldLook, ...timeOfDay[preset].look };
    expect(look.gradeAmount, preset).toBeGreaterThanOrEqual(.5);
    // L9/L10 navigation routes: any haze over the verge cut the night-read road contrast from 2.7 to 2.0-2.4
    // (Scene Lab night-read-* matrix), so those two carry their mood with grade and motes only.
    if (preset === 'L9-crossing' || preset === 'L10-night') expect(look.hazeAmount, preset).toBe(0);
    else expect(look.hazeAmount, preset).toBeGreaterThan(0);
    signatures.add(`${look.gradeShadow}/${look.gradeHighlight}`);
    const day = timeOfDay[preset].intensity >= 1;
    if (day) expect(look.cloudShadow, preset).toBeGreaterThan(0); else expect(look.cloudShadow, preset).toBe(0);
    const ambient = timeOfDay[preset].ambient!;
    expect(ambient.leaf + ambient.dust + ambient.bird, preset).toBeGreaterThan(0);
    // Haze must begin beyond the camera focus (the courier sits at exactly one camera distance).
    expect(look.hazeStart, preset).toBeGreaterThan(1);
  }
  expect(signatures.size).toBe(campaign.length);
});

test('@E25 atmosphere 2: haze range follows the camera distance and beam weight reaches the practical cones', () => {
  const lighting = new Lighting(new Scene());
  try {
    lighting.set('L8-zoo');
    expect(lighting.practicalEffects.beamStrength.value).toBe(timeOfDay['L8-zoo'].look!.beamStrength);
    const camera = new PerspectiveCamera(30, 16 / 9, .1, 500); camera.position.set(0, 14, 13); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    lighting.update({ focus: new Vector3(), radius: 19, driving: false, camera } as unknown as View);
    expect(lighting.hazeNear.value).toBeCloseTo(19 * worldLook.hazeStart); expect(lighting.hazeFar.value).toBeCloseTo(19 * worldLook.hazeEnd);
    lighting.set('night'); expect(lighting.practicalEffects.beamStrength.value).toBe(1);
  } finally { lighting.dispose(); }
});

test('@E29-AC14 courier surface fill leaves the night ground aura and smoke restoration intact', () => {
  const lighting = new Lighting(new Scene());
  try {
    lighting.set('L6');
    expect(timeOfDay.L6.aura).toBe(.45); expect(lighting.heroRim.value).toBe(.22);
    expect(lighting.heroFill.value).toBe(.45 * 3.2); expect(lighting.heroSurfaceFill.value).toBe(.8);
    lighting.setPlayerSmoke(true); expect(lighting.heroFill.value).toBe(.45 * 3.2 + 1);
    expect(lighting.rim.value).toBe(.4); expect(lighting.heroSmokeRim.value).toBe(.2);
    lighting.setPlayerSmoke(false); expect(lighting.heroSmokeRim.value).toBe(0); expect(lighting.heroFill.value).toBe(.45 * 3.2); expect(lighting.heroSurfaceFill.value).toBe(.8);
    const camera = new PerspectiveCamera();
    for (const zoom of [.5, 1, 1.5]) {
      lighting.update({ focus: new Vector3(), radius: cameraFraming.radiusM * zoom, driving: false, camera } as unknown as View);
      expect(lighting.heroRim.value).toBeCloseTo(.22);
      expect(lighting.heroSurfaceFill.value).toBe(.8);
    }
    lighting.set('night'); lighting.setPlayerSmoke(true);
    expect(lighting.rim.value).toBe(.65); expect(lighting.heroSmokeRim.value).toBe(0);
    lighting.setPlayerSmoke(false); expect(lighting.rim.value).toBe(.45);
    lighting.set('L6-subway'); expect(lighting.heroRim.value).toBe(0); expect(lighting.heroFill.value).toBe(1.3 * 3.2); expect(lighting.heroSurfaceFill.value).toBe(0);
  } finally { lighting.dispose(); }
});
