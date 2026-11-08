/** Repair existing emitter bindings in place. Only node names and light/decorative metadata may change. */
import { deepStrictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { lightSourcePath, readGltfJson, type Gltf, type GltfNode } from './lights';
const strip = (name: string) => name.replace(/\.\d{3}$/, '');
const data = (node: GltfNode): Record<string, unknown> | undefined => {
  const raw = node.extras?.ss_light;
  return raw === undefined ? undefined : typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
};
const materials = (g: Gltf, n: GltfNode): string[] => n.mesh === undefined ? [] : [...new Set((g.meshes?.[n.mesh]?.primitives ?? []).flatMap(p => p.material === undefined ? [] : [g.materials?.[p.material]?.name ?? '']))];
const descendants = (g: Gltf, n: GltfNode): GltfNode[] => [n, ...(n.children ?? []).flatMap(i => descendants(g, g.nodes![i]))];
function parents(g: Gltf, n: GltfNode): GltfNode[] {
  const p = g.nodes?.find(p => p.children?.includes(g.nodes!.indexOf(n)));
  return p ? [p, ...parents(g, p)] : [];
}
function nameEmitter(g: Gltf, node: GltfNode): string {
  if (!node.name) node.name = `emitter:${parents(g, node).find(n => n.name)?.name ?? 'root'}:${g.nodes!.indexOf(node)}`;
  return node.name;
}

/** The native exporter already batches by rigid owner/material. Resolve a stale source name into those batches. */
export function bindEmitter(g: Gltf, target: string, sources: Gltf[]): string[] {
  if (g.nodes?.some(n => n.name === target)) return [target];
  const source = sources.find(s => s.nodes?.some(n => n.name === target));
  const original = source?.nodes?.find(n => n.name === target);
  const tokens = original ? [...new Set(descendants(source!, original).flatMap(n => materials(source!, n)))] : [];
  if (!tokens.length && /_(emi|pal)_/.test(target)) tokens.push(target.slice(target.search(/_(emi|pal)_/) + 1));
  if (!tokens.length) return [];
  let candidates = (g.nodes ?? []).filter(n => materials(g, n).some(m => tokens.includes(m)));
  // Use the closest surviving rigid owner. Do not cross an unrelated lamp/door/siren group.
  for (const parent of original ? parents(source!, original) : []) {
    const owner = g.nodes?.find(n => n.name === strip(parent.name ?? ''));
    if (!owner) continue;
    const below = new Set(descendants(g, owner));
    const scoped = candidates.filter(n => below.has(n));
    if (scoped.length) { candidates = scoped; break; }
  }
  return candidates.map(n => nameEmitter(g, n));
}

export interface MetadataProof { path: string; binarySHA256: string; binaryPayloadIdentical: boolean; onlyEmitterMetadataChanged: boolean; beforeBytes: number; afterBytes: number; bindings: { anchor: string; before: string[]; after: string[] }[] }
export function writeMetadata(path: string, g: Gltf, before: Gltf, bindings: MetadataProof['bindings'] = []): MetadataProof | undefined {
  if (JSON.stringify(g) === JSON.stringify(before)) return undefined;
  // Reject accidental geometry, pose, material, animation or scene edits.
  const normalize = (value: Gltf) => {
    const copy = structuredClone(value);
    for (const n of copy.nodes ?? []) {
      delete n.name;
      if (n.extras) {
        delete n.extras.decorativeEmissive;
        const light = data(n);
        if (light) { delete light.emissiveNodes; n.extras.ss_light = light; }
        if (!Object.keys(n.extras).length) delete n.extras;
      }
    }
    return copy;
  };
  deepStrictEqual(normalize(g), normalize(before), path);
  const bytes = readFileSync(path), length = bytes.readUInt32LE(12), tail = bytes.subarray(20 + length);
  let raw = Buffer.from(JSON.stringify(g)); raw = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]);
  const header = Buffer.from(bytes.subarray(0, 20)); header.writeUInt32LE(20 + raw.length + tail.length, 8); header.writeUInt32LE(raw.length, 12);
  const output = Buffer.concat([header, raw, tail]); writeFileSync(path, output);
  return { path, binarySHA256: createHash('sha256').update(tail).digest('hex'), binaryPayloadIdentical: tail.equals(output.subarray(20 + raw.length)), onlyEmitterMetadataChanged: true, beforeBytes: bytes.length, afterBytes: output.length, bindings };
}

if (process.argv[1]?.endsWith('e25-emitter-repair.ts')) {
  const proof: MetadataProof[] = [], unresolved: unknown[] = [];
  const exports = readdirSync('public/assets/models').filter(n => n.endsWith('.glb')).sort();
  const paths = [...new Set(exports.flatMap(f => { const source = lightSourcePath(f); return source ? [source] : []; })), ...exports.map(f => `public/assets/models/${f}`)];
  for (const path of paths) {
    const g = readGltfJson(path), before = structuredClone(g), sources: Gltf[] = [];
    const authored = path.startsWith('public/') ? lightSourcePath(path) : path;
    if (authored && authored !== path) sources.push(readGltfJson(authored));
    const hero = authored?.replace(/\.lod[12]/, '');
    if (hero && hero !== authored && existsSync(hero)) sources.push(readGltfJson(hero));
    sources.push(before);
    const bindings: MetadataProof['bindings'] = [];
    for (const n of g.nodes ?? []) {
      const light = data(n); if (!light) continue;
      let targets = light.emissiveNodes as string[] ?? [];
      // Earlier native exports left empty arrays after failing to match old material-batch names.
      if (!targets.length) {
        const original = sources.flatMap(s => s.nodes ?? []).find(s => strip(s.name ?? '') === strip(n.name ?? '') && (data(s)?.emissiveNodes as string[] | undefined)?.length);
        if (original) targets = data(original)!.emissiveNodes as string[];
      }
      const resolved = targets.flatMap(target => {
        const names = bindEmitter(g, target, sources);
        if (!names.length) { unresolved.push({ path, anchor: n.name, target }); return [target]; }
        return names;
      });
      const next = [...new Set(resolved)].sort();
      if (JSON.stringify(next) !== JSON.stringify(light.emissiveNodes)) {
        bindings.push({ anchor: n.name!, before: light.emissiveNodes as string[] ?? [], after: next });
        light.emissiveNodes = next;
        n.extras!.ss_light = typeof n.extras!.ss_light === 'string' ? JSON.stringify(light) : light;
      }
    }
    const result = writeMetadata(path, g, before, bindings); if (result) proof.push(result);
  }
  const out = 'docs/reports/e25-emitters/evidence/reference-repair.json';
  writeFileSync(out, JSON.stringify({ method: 'Exact existing target, otherwise source material plus closest surviving rigid owner. Binary payload/geometry/poses/materials/animations unchanged.', files: proof, unresolved }, null, 2) + '\n');
  console.log({ files: proof.length, bindings: proof.flatMap(p => p.bindings).length, unresolved: unresolved.length, out });
  if (unresolved.length) console.log(unresolved);
}
