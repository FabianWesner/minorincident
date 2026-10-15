import { expect, test } from 'vitest';
import { forecourt } from '../fixtures/l1Forecourt';

test('PO #5 @E19 a toppled bench cannot close the garage fence gap, including checkpoint restore', async () => {
  const { w } = await forecourt();
  try {
    const props = w.props!, nav = w.infected!.nav;
    const bench = props.items.filter(p => p.assetId === 'prop.bench').sort((a, b) => Math.hypot(a.home.p[0] - 22.8, a.home.p[2] - 34.75) - Math.hypot(b.home.p[0] - 22.8, b.home.p[2] - 34.75))[0];
    for (const yaw of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4]) {
      // Rotate the bench onto its side across the only fence opening, then let physics publish its pose.
      props.place(bench, { p: [22.8, .3, 34.75], q: [Math.SQRT1_2 * Math.cos(yaw / 2), Math.SQRT1_2 * Math.sin(yaw / 2), -Math.SQRT1_2 * Math.sin(yaw / 2), Math.SQRT1_2 * Math.cos(yaw / 2)] });
      props.postPhysics(); props.updateNavigation();
      const path: number[] = [];
      expect(nav.path(nav.nearestCell(22.94, 35.6, .35), nav.nearestCell(22.8, 33, .35), path, 200000), `toppled yaw ${yaw}`).toBe(true);
      expect(nav.visible({ x: 22.8, z: 35.6 }, { x: 22.8, z: 33 }, .4), `gap blocked at yaw ${yaw}`).toBe(true);
    }
    props.restore([{ id: bench.id, p: [22.8, .3, 34.75], q: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] }]);
    expect(nav.visible({ x: 22.8, z: 35.6 }, { x: 22.8, z: 33 }, .4)).toBe(true);
  } finally { w.dispose(); }
});

