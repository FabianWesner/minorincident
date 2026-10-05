import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Box3, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, test } from 'vitest';
import { characterNodes, type SurvivorVariant } from '../../src/data/survivor';
import { createSurvivorPlaceholder } from '../../src/render/characters/placeholder';
import { disposeCharacter, loadCharacter, resolveRig } from '../../src/render/characters/rig';
import { ProceduralAnimator } from '../../src/render/characters/ProceduralAnimator';
import { clips } from '../../src/render/characters/clips';

test('T-E04-08 @E04 @E04-AC08 both supplied GLBs and fallbacks load with every rigid node and 1.4m height', async () => {
  const dimensions = [];
  for (const variant of ['female', 'male'] as const) {
    const file = readFileSync(`assets/char.survivor-${variant}/model.glb`);
    const result = await loadCharacter(variant, async () => (await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene);
    expect(result.source, result.reason ?? '').toBe('glb');
    for (const [model, source] of [[result.model, 'glb'], [createSurvivorPlaceholder(variant), 'placeholder']] as const) {
      const rig = resolveRig(model), box = new Box3().setFromObject(model);
      expect(Math.abs(box.max.y - box.min.y - 1.4), `${variant} ${source}`).toBeLessThanOrEqual(0.07);
      const head = new Box3().setFromObject(rig.head);
      dimensions.push({ variant, source, height: box.max.y - box.min.y, headHeight: head.max.y - head.min.y, headFraction: (head.max.y - head.min.y) / (box.max.y - box.min.y) });
      expect(Object.keys(rig)).toEqual([...characterNodes]);
      for (const side of ['L', 'R'] as const) {
        expect(rig[`foreArm${side}`].parent).toBe(rig[`arm${side}`]);
        expect(rig[`hand${side}`].parent).toBe(rig[`foreArm${side}`]);
        expect(rig[`weaponSocket${side}`].parent).toBe(rig[`hand${side}`]);
      }
      disposeCharacter(model);
    }
  }
  mkdirSync('test-results/epics/E04', { recursive: true }); writeFileSync('test-results/epics/E04/dimensions.json', JSON.stringify(dimensions, null, 2));
});

test('T-E04-08b @E04 @E04-AC08 missing or invalid assets fall back independently with the same rig', async () => {
  for (const variant of ['female', 'male'] as SurvivorVariant[]) {
    for (const load of [async () => { throw new Error('unavailable'); }, async () => new Group()]) {
      const result = await loadCharacter(variant, load); expect(result.source).toBe('placeholder'); expect(result.reason).toBeTruthy();
      expect(Object.keys(result.rig)).toHaveLength(19); disposeCharacter(result.model);
    }
  }
});

test('T-E04-animation @E04 procedural clips preserve rest transforms and move joint descendants', () => {
  const model = createSurvivorPlaceholder('female'), rig = resolveRig(model), animator = new ProceduralAnimator(rig);
  const pose = { variant: 'female' as const, gearTier: 0 as const, animation: 'run' as const, animationTick: 0, velocity: { x: 4.5, z: 0 }, grounded: true, invulnerableUntil: 0, checkpoint: { x: 0, y: 0.7, z: 0 }, diedAt: null };
  animator.update(pose, 7); const angle = rig.legL.rotation.z;
  animator.update(pose, 7); expect(rig.legL.rotation.z).toBe(angle); expect(Math.abs(angle)).toBeGreaterThan(0.1);
  expect(Object.keys(clips).sort()).toEqual(['idle', 'walk', 'run', 'hurt', 'die', 'swing', 'shoot', 'throw', 'kick', 'interact', 'enter-car'].sort());
  disposeCharacter(model);
});
