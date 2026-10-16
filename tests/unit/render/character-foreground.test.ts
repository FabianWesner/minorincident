import { Group, Mesh, BoxGeometry, MeshBasicNodeMaterial } from 'three/webgpu';
import { expect, test } from 'vitest';
import { CharacterView } from '../../../src/render/characters/CharacterView';

test('courier foreground keeps its own silhouette without changing the boss and restores ordinary depth', () => {
  const character = new CharacterView(), geometry = new BoxGeometry(), first = new MeshBasicNodeMaterial(), second = new MeshBasicNodeMaterial();
  const model = new Group(), body = new Mesh(geometry, first); model.add(body); character.add(model);
  character.setForeground(true); expect(first.depthTest).toBe(false); expect(body.renderOrder).toBe(20);
  // Gear arriving while the silhouette is enabled follows the same presentation rule.
  const gear = new Mesh(geometry, second); model.add(gear); character.setForeground(true);
  expect(second.depthTest).toBe(false); expect(gear.renderOrder).toBe(20);
  character.setForeground(false);
  for (const mesh of [body, gear]) { expect(mesh.material.depthTest).toBe(true); expect(mesh.renderOrder).toBe(0); }
  geometry.dispose(); first.dispose(); second.dispose();
});
