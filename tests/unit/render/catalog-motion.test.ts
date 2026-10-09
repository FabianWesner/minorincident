import { Vector3 } from 'three';
import { expect, test } from 'vitest';
import { drive, load } from '../../../tools/crowdfoot/harness';
import { summarizeMotion } from '../../../src/debug/scenelab/motion';
import { tyreSurface } from '../../../src/render/TyreContact';
import { CourierGroundContacts } from '../../../src/render/characters/CourierGroundContacts';
import { resolveRig } from '../../../src/render/characters/rig';
import { createSurvivorPlaceholder } from '../../../src/render/characters/placeholder';

test.each(['veh.ambulance', 'veh.school-bus'])('far %s tyre stays round as it rolls', async asset => {
  const root = await load(`${asset}.lod2`), points = tyreSurface(root.getObjectByName('wheelFL')!);
  const heights = Array.from({ length: 360 }, (_, degree) => {
    const angle = degree * Math.PI / 180;
    return Math.min(...points.map(p => p.x * Math.sin(angle) + p.y * Math.cos(angle)));
  });
  expect((Math.max(...heights) - Math.min(...heights)) * 100).toBeLessThan(1.5);
});

test('grounding an authored kick keeps leg rotations and puts the supporting sole on the floor', () => {
  const root = createSurvivorPlaceholder('female'), rig = resolveRig(root);
  root.scale.setScalar(1.3); root.position.y = .05; root.updateMatrixWorld(true);
  const sole = rig.footL.getWorldPosition(new Vector3()).y - root.position.y;
  const contacts = new CourierGroundContacts(rig);
  rig.hip.position.y -= .025 / 1.3; rig.legR.rotation.z = -.9; rig.shinR.rotation.z = .5;
  const rotations = [rig.legL, rig.legR, rig.shinR].map(n => n.quaternion.clone());
  contacts.groundPose();
  const lowest = Math.min(...[rig.footL, rig.footR].flatMap(foot => [-.05, .085].map(x => foot.localToWorld(new Vector3(x, -sole / 1.3, 0)).y)));
  expect(lowest).toBeCloseTo(.05, 5);
  [rig.legL, rig.legR, rig.shinR].forEach((n, i) => expect(n.quaternion.angleTo(rotations[i])).toBeLessThan(1e-6));
  const hip = rig.hip.position.clone(); contacts.groundPose(); expect(rig.hip.position.toArray()).toEqual(hip.toArray());
});

test('far pedestrian steps move between sole contacts at the actual travel speed', async () => {
  const frames = await drive('npc.civilian-man-a.lod2', { kind: 'civilian' }, 5, () => ({ speed: 1.25, yaw: 0 }), false);
  const motion = summarizeMotion(frames.map((f, i) => ({ frame: i + 1, floor: 0, feet: f.feet.map(p => ({ heel: p.heel.toArray(), toe: p.toe.toArray(), yaw: p.yaw })) })));
  expect(motion.contacts).toBeGreaterThan(10);
  expect(motion.slideMaxCm).toBeLessThan(3);
  expect(motion.sinkMaxCm).toBeLessThan(1);
});

test.each([false, true])('a pedestrian keeps world foot contacts between near/far batches (split: %s)', async split => {
  const frames = await drive('npc.civilian-woman-a.lod2', { kind: 'civilian' }, 5, () => ({ speed: 3.2, yaw: 0 }), t => t < 2 || t > 3, 1, split);
  const motion = summarizeMotion(frames.map((f, i) => ({ frame: i + 1, floor: 0, feet: f.feet.map(p => ({ heel: p.heel.toArray(), toe: p.toe.toArray(), yaw: p.yaw })) })));
  expect(motion.slideMaxCm).toBeLessThan(6);
  expect(motion.sinkMaxCm).toBeLessThan(1);
});
