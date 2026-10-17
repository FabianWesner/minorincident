import { readFileSync, writeFileSync } from 'node:fs';
import { getBounds } from '@gltf-transform/functions';
import { assetIO } from './io';
import manifest from '../../src/assets/manifest.json';
import { pushableProps } from '../../src/data/pushableProps';

/** Migrate legacy movable-prop collider empties into explicit GLTF Y-up bounds.
 * Geometry/BIN chunks are preserved byte-for-byte; run after rebuilding legacy Blender sources. */
const io = await assetIO();
for (const asset of manifest.filter(a => a.id in pushableProps)) {
  for (const file of new Set([asset.glb, asset.sourceGlb].filter((f): f is string => !!f))) {
    const doc = await io.read(file), bounds = getBounds(doc.getRoot().listScenes()[0]);
    const record = pushableProps[asset.id];
    const min = [0, 1, 2].map(a => Math.min(...record.boxes.map(b => b.min[a]))), max = [0, 1, 2].map(a => Math.max(...record.boxes.map(b => b.max[a])));
    const validClass = record.mass <= 15 ? 'light' : record.mass < 150 ? 'medium' : 'heavy';
    const validBounds = min.every((v, a) => Math.abs(v - bounds.min[a]) <= .15 * (bounds.max[a] - bounds.min[a])) && max.every((v, a) => Math.abs(v - bounds.max[a]) <= .15 * (bounds.max[a] - bounds.min[a]));
    const validCom = record.centerOfMass?.every((v, a) => v >= min[a] && v <= max[a]);
    const cartMass = asset.id === 'prop.shopping-cart' && record.mass !== 35;
    if (record.class === validClass && validBounds && validCom && !cartMass && record.reset) continue;
    const bytes = readFileSync(file), jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const root = json.nodes.find((n: { extras?: { ss_physics?: unknown } }) => n.extras?.ss_physics);
    const physics = typeof root.extras.ss_physics === 'string' ? JSON.parse(root.extras.ss_physics) : root.extras.ss_physics;
    if (asset.id === 'prop.shopping-cart') physics.mass = 35; // E26-AC03 reference cart.
    const mass = physics.mass;
    physics.class = mass <= 15 ? 'light' : mass < 150 ? 'medium' : 'heavy';
    // Retain the authored COM where valid; legacy Blender-Z-up COMs are brought into the collider.
    const center = bounds.min.map((v, a) => (v + bounds.max[a]) / 2);
    if (!physics.centerOfMass || physics.centerOfMass.some((v: number, a: number) => v < bounds.min[a] || v > bounds.max[a])) physics.centerOfMass = center;
    physics.reset ??= 'spawn'; root.extras.ss_physics = physics;
    if (!validBounds || !validCom) {
      const existing = json.nodes.findIndex((n: { name?: string }) => n.name === 'col:physics');
      for (const node of json.nodes) if (node.name !== 'col:physics' && node.name?.startsWith('col:')) node.name = node.name.replace('col:', 'legacy-col:');
      const index = existing < 0 ? json.nodes.length : existing;
      json.nodes[index] = { name: 'col:physics', translation: center, extras: { size: bounds.min.map((v, a) => bounds.max[a] - v), space: 'gltf' } };
      if (existing < 0) json.scenes[json.scene ?? 0].nodes.push(index);
    }
    const raw = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(padded);
    const header = Buffer.from(bytes.subarray(0, 20)), tail = bytes.subarray(20 + jsonLength);
    header.writeUInt32LE(20 + padded.length + tail.length, 8); header.writeUInt32LE(padded.length, 12);
    writeFileSync(file, Buffer.concat([header, padded, tail]));
  }
}
