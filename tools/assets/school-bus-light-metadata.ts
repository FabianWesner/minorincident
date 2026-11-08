/** Repair native school-bus emitter references without re-exporting geometry. */
import { deepStrictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readGltfJson } from './lights';
const evidence = [];
for (const tier of [1, 2]) {
  const authored = readGltfJson(`assets/veh.school-bus/model.lod${tier}.glb`);
  for (const path of [`assets/veh.school-bus/model.lod${tier}.glb`, `public/assets/models/veh.school-bus.lod${tier}.glb`]) {
    const bytes = readFileSync(path), oldLength = bytes.readUInt32LE(12), json = readGltfJson(path), before = structuredClone(json);
    for (const node of json.nodes ?? []) {
      const raw = node.extras?.ss_light; if (!raw) continue;
      const light = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
      const material = light.type === 'spot' ? 'emi_windowGlow' : 'emi_sirenRed';
      light.emissiveNodes = authored.nodes!.filter(n => n.mesh !== undefined && authored.meshes![n.mesh].primitives.some(p => p.material !== undefined && authored.materials![p.material].name === material)).map(n => n.name).sort();
      node.extras!.ss_light = typeof raw === 'string' ? JSON.stringify(light) : light;
    }
    const normalized = structuredClone(json); normalized.nodes!.forEach((n, i) => { if (before.nodes![i].extras?.ss_light) n.extras!.ss_light = before.nodes![i].extras!.ss_light; }); deepStrictEqual(normalized, before);
    let raw = Buffer.from(JSON.stringify(json)); raw = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
    const tail = bytes.subarray(20 + oldLength), header = Buffer.from(bytes.subarray(0, 20)); header.writeUInt32LE(20 + raw.length + tail.length, 8); header.writeUInt32LE(raw.length, 12); writeFileSync(path, Buffer.concat([header, raw, tail]));
    evidence.push({ path, binarySHA256: createHash('sha256').update(tail).digest('hex'), binaryPayloadIdentical: true, onlyEmissiveReferencesChanged: true });
  }
}
writeFileSync('docs/reports/e25-verify/evidence/school-bus-glb-identity.json', JSON.stringify(evidence, null, 2) + '\n');
