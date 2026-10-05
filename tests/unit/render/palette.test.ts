import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Object3D, Matrix4, Vector3 } from 'three/webgpu';
import { palette } from '../../../src/data/palette';
import { InstancedGroup } from '../../../src/render/InstancedGroup';

test('T-E02-05 @E02 @E02-AC05 palette matches every art-direction token exactly', () => {
  const section = readFileSync('specs/01-art-direction.md', 'utf8').split('## 3. Palette')[1].split('## 4.')[0];
  const rows = [...section.matchAll(/^\| `([^`]+)`(?: \/ `([^`]+)`)? \|[^\n]+?\| `(#\w+)`(?: \/ `(#\w+)`)?/gm)];
  const tokens = Object.fromEntries(rows.flatMap((m) => m[2] ? [[m[1], m[3]], [m[2], m[4]]] : [[m[1], m[3]]]));
  expect(tokens).toEqual(palette);
});

test('T-E02-instancing @E02 nested prototype transforms and dirty instance bounds stay correct', () => {
  const prototype = new Group(); const child = new Group(); child.position.set(1, 2, 0); prototype.add(child);
  const geometry = new BoxGeometry(); const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material); mesh.position.set(2, 0, 0); child.add(mesh);
  const reference = new Object3D(); reference.position.set(5, 0, 0);
  const group = new InstancedGroup(prototype, [reference]);
  const batch = group.children[0] as import('three').InstancedMesh, matrix = new Matrix4();
  batch.getMatrixAt(0, matrix); expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([8, 2, 0]);
  reference.position.x = 15; group.update([0]); batch.getMatrixAt(0, matrix);
  expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([18, 2, 0]);
  expect(batch.boundingSphere!.center.x).toBe(18);
  group.dispose(); geometry.dispose(); material.dispose();
});
