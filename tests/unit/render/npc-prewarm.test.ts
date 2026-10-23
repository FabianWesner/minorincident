import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three/webgpu';
import { NpcView } from '../../../src/render/npc/NpcView';

test('loading warms the real escort head geometry and materials alongside the corgi without moving the prototypes', () => {
  const view = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const prototypes = Array.from({ length: 3 }, () => { const root = new Group(); root.add(new Mesh(geometry, material)); return root; });
  Object.assign(view, { dog: prototypes[0], child: prototypes[1], humans: new Map([['clerk', prototypes[2]]]) });
  const restore = NpcView.prototype.prewarmCorgi.call(view as unknown as NpcView, new Vector3(3, 4, 5));
  const root = view.children[0]; expect(root.position.toArray()).toEqual([3, 4, 5]); expect(root.children).toHaveLength(3);
  for (const clone of root.children) { const mesh = clone.children[0] as Mesh; expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material); }
  restore(); expect(view.children).toHaveLength(0);
  for (const prototype of prototypes) { expect(prototype.parent).toBeNull(); expect(prototype.position.toArray()).toEqual([0, 0, 0]); }
  geometry.dispose(); material.dispose();
});
