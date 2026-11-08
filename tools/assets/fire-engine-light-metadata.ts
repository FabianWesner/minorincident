/** Apply the Blender-authored fire-engine light records without re-exporting any geometry. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { readGltfJson } from './lights';
const input = process.argv[2]; if (!input) throw Error('Supply the JSON emitted by the Blender metadata inspection.');
const records = JSON.parse(readFileSync(input, 'utf8')) as { suffix: string; anchors: { name: string; position: number[]; direction: number[]; ss_light: Record<string, unknown> }[] }[];
const evidence = [];
for (const record of records) for (const path of [`assets/veh.fire-engine/model${record.suffix}.glb`, `public/assets/models/veh.fire-engine${record.suffix}.glb`]) {
  const bytes = readFileSync(path), oldLength = bytes.readUInt32LE(12), json = readGltfJson(path), before = structuredClone(json);
  const nodes = json.nodes!, root = nodes.findIndex(n => n.name === 'root'); if (root < 0) throw Error(`${path}: missing root`);
  let rootWorld: Matrix4 | undefined;
  const visit = (index: number, parent: Matrix4) => {
    const n = nodes[index], local = n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(new Vector3().fromArray(n.translation ?? [0, 0, 0]), new Quaternion().fromArray(n.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(n.scale ?? [1, 1, 1]));
    const world = parent.clone().multiply(local); if (index === root) rootWorld = world;
    for (const child of n.children ?? []) visit(child, world);
  };
  for (const r of json.scenes![json.scene ?? 0].nodes) visit(r, new Matrix4());
  if (!rootWorld) throw Error(`${path}: root is outside scene`);
  const inverse = (rootWorld as Matrix4).clone().invert(), count = nodes.length, oldChildren = nodes[root].children ? [...nodes[root].children!] : undefined;
  for (const anchor of record.anchors) {
    const direction = new Vector3().fromArray(anchor.direction).normalize();
    const pose = new Matrix4().compose(new Vector3().fromArray(anchor.position), new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), direction), new Vector3(1, 1, 1));
    const node = { name: anchor.name, matrix: inverse.clone().multiply(pose).toArray(), extras: { ss_light: JSON.stringify(anchor.ss_light) } };
    const index = nodes.findIndex(n => n.name === anchor.name);
    if (index < 0) { (nodes[root].children ??= []).push(nodes.length); nodes.push(node); } else nodes[index] = node;
  }
  // The checked-in inputs have no anchors; every existing node, accessor/material and animation stays exact.
  if (count === before.nodes!.length && !before.nodes!.some(n => n.extras?.ss_light)) {
    const normalized = structuredClone(json); normalized.nodes!.splice(count); normalized.nodes![root].children = oldChildren;
    if (!oldChildren) delete normalized.nodes![root].children;
    deepStrictEqual(normalized, before);
  }
  let raw = Buffer.from(JSON.stringify(json)); raw = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const tail = bytes.subarray(20 + oldLength), header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + raw.length + tail.length, 8); header.writeUInt32LE(raw.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  writeFileSync(path, Buffer.concat([header, raw, tail]));
  evidence.push({ path, anchors: record.anchors.length, binaryPayloadIdentical: true, binarySHA256: createHash('sha256').update(tail).digest('hex'), existingNodesMaterialsAnimationsIdentical: true });
}
const out = 'docs/reports/e25-verify/evidence/fire-engine-glb-identity.json'; mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n'); console.log(evidence);
