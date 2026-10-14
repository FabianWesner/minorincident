import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSpec } from '../../../tools/scenelab/session';
import { edgeNoise } from '../../../tools/scenelab/edge-noise';
import { validateSpec } from '../../../src/debug/scenelab/spec';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';

const directory = 'tests/scenes/catalog';
const scenes = new Map(readdirSync(directory).filter(f => f.startsWith('l10-q1-')).map(f => [f.slice(0, -5), readSpec(`${directory}/${f}`)]));
const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));

describe('L10-Q1 Scene Lab catalog @E32', () => {
  it('T-E32-30-catalog @E32-AC30 resolves every fixture at the game camera and includes it in scene:matrix', () => {
    expect(scenes.size).toBeGreaterThanOrEqual(31);
    for (const [name, scene] of scenes) {
      expect(validateSpec(scene, assets), name).toEqual([]);
      expect(['game', 'follow'], name).toContain(scene.camera?.mode);
      expect(scene.name).toBe(name);
      expect(scene.expect?.consoleErrors).toBe(0);
    }
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['scene:matrix']).toContain('l10-q1-*');
    expect(pkg.scripts['scene:matrix']).toContain('E2E_UNITS=2');
  });
  it('T-E32-30-regions @E32-AC30 covers all seven production district regions without scaling props', () => {
    for (let region = 1; region <= 7; region++) {
      const scene = [...scenes].find(([name]) => name.startsWith(`l10-q1-r${region}-`))?.[1];
      expect(scene?.layout?.district).toBe('D-CURE');
      expect(scene?.ground).toBe('district');
      expect(scene?.expect?.lodPlaceholderFramesMax).toBe(0);
      expect(scene?.props).toBeUndefined();
    }
  });
  it('T-E32-07-dog @E32-AC07 retains seeded runtime coats and the real chase telegraph', () => {
    expect(scenes.get('l10-q1-dog-coats')?.actors?.filter(a => a.archetype === 'infected.dog')).toHaveLength(3);
    expect(scenes.get('l10-q1-dog-telegraph')?.actors?.find(a => a.archetype === 'infected.dog')?.state).toBe('chase');
  });
  it('T-E32-10/11/14-fixtures @E32-AC10 @E32-AC11 @E32-AC14 uses one persistent pursuit and the production move scheduler/HUD', () => {
    for (const [name, special] of [['charge', 'alpha.charge'], ['slam', 'alpha.ground-slam'], ['grab', 'alpha.grab-throw']]) {
      const scene = scenes.get(`l10-q1-mega-${name}`);
      expect(scene?.megaAlpha?.id).toBe('mega');
      expect(scene?.script).toContainEqual({ frame: 0, actor: 'mega', do: { special, target: 'courier' } });
      expect(scene?.expect?.specialActiveMin).toBe(1);
      expect(scene?.expect?.specialActiveMove).toBe(special);
      expect(scenes.get(`l10-q1-mega-${name}-wall`)?.props?.length).toBeGreaterThan(0);
      const dodge = scenes.get(`l10-q1-mega-${name}-dodge`);
      expect(dodge?.actors?.[0].god).toBe(false);
      expect(dodge?.expect?.specialActiveMin).toBe(1);
      expect(dodge?.expect?.specialActiveMove).toBe(special);
      expect(dodge?.expect?.courierHpMin).toBe(100);
      expect(dodge?.script?.some(s => 'actor' in s && s.actor === 'courier' && typeof s.do === 'object' && 'run' in s.do)).toBe(true);
    }
    expect(scenes.get('l10-q1-audio-ring-dead')?.script).toContainEqual({ frame: 0, actor: 'mega', do: { corpse: true } });
    expect(scenes.get('l10-q1-mega-pursuit-coarse')?.megaAlpha?.resident).toBeDefined();
    for (const distance of [250, 120, 40, 20]) {
      const scene = scenes.get(`l10-q1-audio-ring-${distance}`);
      expect(scene?.megaHud).toBe(true); expect(scene?.hud).toBe(true);
      expect(scene?.megaAlpha?.at).toEqual([-distance, 0]);
    }
  });
  it('T-E32-16-carry @E32-AC16 restores the real carried checkpoint for both courier rigs', () => {
    for (const [name, model] of [['cure-carry', 'male'], ['cure-carry-female', 'female']]) {
      const scene = scenes.get(`l10-q1-${name}`);
      expect(scene?.cureProgression).toEqual({ checkpoint: 'cure-research', authored: true });
      expect(scene?.actors?.[0].look?.model).toBe(model);
    }
  });
  it('T-E32-09-edge-noise @E32-AC09 rejects black/white triangles while accepting a continuous dark silhouette', () => {
    const pixels = (jagged: boolean) => {
      const data = new Uint8Array(24 * 24 * 4);
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const shade = x > 6 && x < 18 && y > 2 && y < 22 ? jagged && (x + y) % 2 ? 220 : 20 : 85;
        data.set([shade, shade, shade, 255], (y * 24 + x) * 4);
      }
      return edgeNoise(data, 24, 24, [0, 0, 1, 1]);
    };
    const limit = scenes.get('l10-q1-alpha-silhouette-known-low-defect')!.edgeNoise!.extremeEdgeShareMax;
    expect(pixels(false).edges).toBeGreaterThan(20);
    expect(pixels(false).extremeEdgeShare).toBeLessThan(limit);
    expect(pixels(true).extremeEdgeShare).toBeGreaterThan(limit);
  });
});
