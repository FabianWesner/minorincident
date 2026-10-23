import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Document } from '@gltf-transform/core';
import { assetIO } from './io';

const variants = [
  'assets/veh.school-bus/model.wrecked.glb',
  'assets/veh.school-bus/model.wrecked.lod1.glb',
  'assets/veh.school-bus/model.wrecked.lod2.glb',
  'public/assets/models/veh.school-bus.wrecked.glb',
  'public/assets/models/veh.school-bus.wrecked.lod1.glb',
  'public/assets/models/veh.school-bus.wrecked.lod2.glb',
];
const l2 = ['assets/veh.school-bus/model.lod2.glb', 'public/assets/models/veh.school-bus.lod2.glb'];

function addEmptyNodes(document: Document, source: Document, names: string[]): boolean {
  const existing = new Set(document.getRoot().listNodes().map(node => node.getName()));
  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error('School bus delivery has no scene');
  let changed = false;
  for (const name of names) {
    if (existing.has(name)) continue;
    const original = source.getRoot().listNodes().find(node => node.getName() === name);
    if (!original) throw new Error(`School bus source node missing: ${name}`);
    const matrix = Array.from(original.getWorldMatrix()) as Parameters<ReturnType<Document['createNode']>['setMatrix']>[0];
    const pivot = document.createNode(name).setMatrix(matrix);
    scene.addChild(pivot);
    existing.add(name); changed = true;
  }
  return changed;
}

export async function completeSchoolBusNodes(): Promise<void> {
  const io = await assetIO();
  const base = await io.read('assets/veh.school-bus/model.glb');
  const sockets = ['steeringWheel', ...Array.from({ length: 4 }, (_, row) => [`passengerSeat${row}L`, `passengerSeat${row}R`]).flat()];
  for (const path of variants) {
    const document = await io.read(path);
    if (addEmptyNodes(document, base, sockets)) writeFileSync(path, await io.writeBinary(document));
  }

  const doors = await io.read('assets/veh.school-bus/model.glb');
  const doorPivots = ['door_far_0:pal_uiDark', 'door_near_0:pal_uiDark'];
  for (const path of l2) {
    const document = await io.read(path);
    if (addEmptyNodes(document, doors, doorPivots)) writeFileSync(path, await io.writeBinary(document));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await completeSchoolBusNodes();
