import { Group, Object3D } from 'three';
import { expect, test } from 'vitest';
import { crowdModelOf, restoreStanding } from '../../../src/render/npc/CivilianCrowd';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('crowd model id comes from the appearance, the civilian record or the L1 variant default (no fixed id list)', () => {
  const e = (extra: object) => ({ ...extra } as unknown as EntitySnapshot);
  expect(crowdModelOf(e({ appearance: { asset: 'npc.rosa.aftermath' } }))).toBe('npc.rosa.aftermath');
  expect(crowdModelOf(e({ civilian: { model: 'npc.marcus.aftermath', variant: 'x' } }))).toBe('npc.marcus.aftermath');
  expect(crowdModelOf(e({ civilian: { variant: 'inf.suburban-mom' } }))).toBe('npc.civilian-woman-a');
  expect(crowdModelOf(e({ civilian: { variant: 'cashier' } }))).toBe('npc.civilian-man-a');
  expect(crowdModelOf(e({}))).toBeNull();
});

test('protected children use child proportions even with an adult appearance from an old checkpoint @E08', () => {
  expect(crowdModelOf({ civilian: { adult: false, model: 'npc.civilian-woman-b' }, appearance: { asset: 'npc.civilian-woman-b' } } as unknown as EntitySnapshot)).toBe('npc.civilian-kid');
});

test('sitting and lying skins are restored to the exported standing pose and lose their rest-only nodes', () => {
  const root = new Group(), hip = new Object3D(), cushion = new Object3D();
  hip.name = 'hip'; cushion.name = 'restCushion'; hip.position.set(0, .2, 0); hip.add(cushion); root.add(hip);
  root.userData = { ss_standingPose: JSON.stringify({ hip: { translation: [0, .9, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } }), restOnlyNodes: ['restCushion'] };
  restoreStanding(root);
  expect(hip.position.y).toBeCloseTo(.9);
  expect(root.getObjectByName('restCushion')).toBeUndefined();
  const plain = new Group(); plain.add(new Object3D());
  restoreStanding(plain);
  expect(plain.children).toHaveLength(1);
});
