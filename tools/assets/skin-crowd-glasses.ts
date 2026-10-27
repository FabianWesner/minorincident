/** Restore thin authored rectangular frames around the measured v2 eye landmarks. */
import type { Document } from '@gltf-transform/core';
import { CylinderGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function restoreCrowdGlasses(document: Document, lod: number): void {
  const head = document.getRoot().listNodes().find(n => n.getName() === 'head')!;
  const eyes = document.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')!.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
  if (eyes.getCount() !== 12) throw Error('Rectangular frames require two triangle-expanded eye quads');
  const centres = [0, 1].map(side => {
    const point = new Vector3();
    for (let k = 0; k < 6; k++) point.add(new Vector3().fromArray(eyes.getElement(side * 6 + k, [])));
    return point.multiplyScalar(1 / 6).add(new Vector3(.004, 0, 0));
  }).sort((a, b) => a.z - b.z);
  const pieces: CylinderGeometry[] = [];
  const tube = (a: Vector3, b: Vector3) => {
    const direction = b.clone().sub(a), geometry = new CylinderGeometry(.0025, .0025, direction.length(), lod ? 4 : 6);
    const matrix = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()));
    matrix.setPosition(a.clone().add(b).multiplyScalar(.5)); geometry.applyMatrix4(matrix); pieces.push(geometry);
  };
  for (const centre of centres) {
    const corners = [[-.039, -.039], [.039, -.039], [.039, .039], [-.039, .039]].map(([y, z]) => centre.clone().add(new Vector3(0, y, z)));
    for (let k = 0; k < 4; k++) tube(corners[k], corners[(k + 1) % 4]);
    const side = Math.sign(centre.z), start = centre.clone().add(new Vector3(0, .022, side * .039));
    tube(start, start.clone().add(new Vector3(-.17, 0, side * .025)));
  }
  tube(centres[0].clone().add(new Vector3(0, .012, .039)), centres[1].clone().add(new Vector3(0, .012, -.039)));
  const geometry = mergeGeometries(pieces)!; pieces.forEach(piece => piece.dispose());
  geometry.applyMatrix4(new Matrix4().fromArray(head.getWorldMatrix()).invert());
  const primitive = document.createPrimitive().setMaterial(document.createMaterial('pal_uiDark').setBaseColorFactor([.015, .015, .015, 1]).setMetallicFactor(0).setRoughnessFactor(1));
  for (const [name, type, source] of [['POSITION', 'VEC3', 'position'], ['NORMAL', 'VEC3', 'normal'], ['TEXCOORD_0', 'VEC2', 'uv']] as const) primitive.setAttribute(name, document.createAccessor().setType(type).setArray(new Float32Array(geometry.getAttribute(source).array)));
  primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint16Array(geometry.index!.array)));
  head.addChild(document.createNode('story_glasses').setMesh(document.createMesh('story_glasses').addPrimitive(primitive)));
  geometry.dispose();
}
