import { expect, test, vi } from 'vitest';
import { Group, Object3D } from 'three';
import { updateWorldTranslation } from '../../../src/render/characters/updateWorldTranslation';

test('translation-only rig refresh exactly matches full products through scaled and reflected ancestors', () => {
  const scene = new Group(), frame = new Group(), hip = new Object3D(); scene.add(frame); frame.add(hip);
  const nodes = [hip];
  for (let i = 1; i < 60; i++) { const node = new Object3D(); nodes[Math.floor((i - 1) / 3)].add(node); nodes.push(node); }
  nodes.forEach((node, i) => { if (i > 0 && i % 3 === 0) node.matrixAutoUpdate = false; });
  for (const mirror of [-1, 1]) for (let tick = 0; tick < 40; tick++) {
    scene.position.set(30, 2, -40); scene.rotation.y = tick / 3; frame.scale.set(mirror * 1.2, .8, 1.1); frame.rotation.set(.2, -.1, .3);
    nodes.forEach((node, i) => { node.position.set(i / 70, .1 + tick / 60, -.02); node.rotation.set(tick / 50, i / 20, tick / 70); node.scale.set(1.01, .99, 1.02); if (!node.matrixAutoUpdate) node.updateMatrix(); });
    scene.updateMatrixWorld(true);
    const update = vi.spyOn(nodes.at(-1)!, 'updateMatrix');
    hip.position.y += .013; hip.position.z -= .004;
    updateWorldTranslation(hip); expect(update).not.toHaveBeenCalled(); update.mockRestore();
    const actual = nodes.map(node => node.matrixWorld.clone()); hip.updateWorldMatrix(true, true);
    nodes.forEach((node, i) => expect(node.matrixWorld.elements).toEqual(actual[i].elements));
  }
});
