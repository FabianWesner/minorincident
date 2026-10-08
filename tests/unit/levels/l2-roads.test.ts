import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import { overlapsRoad } from '../../../src/levels/districts/validate';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { pushableProps } from '../../../src/data/pushableProps';
import { compositions } from '../../../src/levels/compositions';
import { SimWorld } from '../../../src/sim/world/SimWorld';

const grove = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;

test('L2 starts with no loose furniture footprint in a driving lane, including inherited and dressed props', () => {
  const [layout] = levelTwoLayouts([grove]);
  const loose = layout.placements.filter(p => pushableProps[p.assetId] && !p.id.startsWith('l2-checkpoint-'));
  expect(loose.length).toBeGreaterThan(10);
  expect(loose.filter(p => overlapsRoad(layout, p.visualAabb)).map(p => p.id)).toEqual([]);
  expect(layout.placements.filter(p => p.assetId === 'prop.broken-chair').length).toBeGreaterThan(0);
  expect(grove.placements.some(p => p.id.startsWith('l2-'))).toBe(false);
});

test('L2 assembly rejects carried furniture on a road; gameplay/checkpoint restoration keeps a displaced pose', async () => {
  const world = new SimWorld(); await world.init();
  try {
    world.loadComposition(compositions.L2, [grove], 1);
    const item = world.props!.items.find(p => p.assetId === 'prop.lawn-chair-a')!;
    const roadPose = { id: item.id, p: [-30, .2, -20] as [number, number, number], q: [.7071067811865476, 0, 0, .7071067811865476] as [number, number, number, number] };
    // Reassembly normally happens after the old physics world is disposed.
    for (const old of world.props!.items) world.physics.world!.removeRigidBody(old.body);
    world.props!.install(world.districts!, [roadPose]);
    const rebuilt = world.props!.items.find(p => p.id === item.id)!;
    expect(rebuilt.pose.p[0]).toBeCloseTo(rebuilt.home.p[0]);
    expect(rebuilt.pose.p[2]).toBeCloseTo(rebuilt.home.p[2]);
    world.props!.restore([roadPose]);
    rebuilt.pose.p.forEach((v, i) => expect(v).toBeCloseTo(roadPose.p[i], 6));
    rebuilt.pose.q.forEach((v, i) => expect(v).toBeCloseTo(roadPose.q[i], 6));
    world.setTier(2);
    const afterTier = world.props!.items.find(p => p.id === item.id)!;
    expect(afterTier.pose.p[0]).toBeCloseTo(roadPose.p[0]);
    expect(afterTier.pose.p[2]).toBeCloseTo(roadPose.p[2]);
  } finally { world.dispose(); }
});
