/** Summarize a CDP heap snapshot and retain strong root paths to its largest allocations.
 * An optional baseline limits allocations to objects created since that snapshot. */
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw Error('Usage: tsx tools/perf/heap-retainers.ts snapshot [output.json] [baseline.heapsnapshot]');
type Heap = {
  snapshot: { meta: { node_fields: string[]; node_types: (string[] | string)[]; edge_fields: string[]; edge_types: (string[] | string)[] } };
  nodes: number[]; edges: number[]; strings: string[];
};
const baseline = process.argv[4];
const baselineIds = baseline ? (() => {
  const previous = JSON.parse(readFileSync(baseline, 'utf8')) as Heap;
  const fields = previous.snapshot.meta.node_fields, id = fields.indexOf('id');
  const ids = new Set<number>();
  for (let offset = 0; offset < previous.nodes.length; offset += fields.length) ids.add(previous.nodes[offset + id]);
  return ids;
})() : undefined;
const heap = JSON.parse(readFileSync(input, 'utf8')) as Heap;
const meta = heap.snapshot.meta, nf = meta.node_fields.length, ef = meta.edge_fields.length;
const ni = Object.fromEntries(meta.node_fields.map((key, i) => [key, i]));
const ei = Object.fromEntries(meta.edge_fields.map((key, i) => [key, i]));
const types = meta.node_types[ni.type] as string[], edgeTypes = meta.edge_types[ei.type] as string[];
const count = heap.nodes.length / nf, offsets = new Uint32Array(count + 1);
const groups = new Map<string, { count: number; bytes: number }>();
const newGroups = new Map<string, { count: number; bytes: number }>();
const largest: { node: number; bytes: number }[] = [];
for (let n = 0; n < count; n++) {
  offsets[n + 1] = offsets[n] + heap.nodes[n * nf + ni.edge_count] * ef;
  const type = types[heap.nodes[n * nf + ni.type]], name = heap.strings[heap.nodes[n * nf + ni.name]], bytes = heap.nodes[n * nf + ni.self_size];
  const key = `${type}:${name}`, group = groups.get(key) ?? { count: 0, bytes: 0 };
  group.count++; group.bytes += bytes; groups.set(key, group);
  const created = !baselineIds?.has(heap.nodes[n * nf + ni.id]);
  if (created) { const group = newGroups.get(key) ?? { count: 0, bytes: 0 }; group.count++; group.bytes += bytes; newGroups.set(key, group); }
  if (created && bytes > 100_000) largest.push({ node: n, bytes });
}
const parent = new Int32Array(count).fill(-1), edge = new Int32Array(count).fill(-1), queue = new Uint32Array(count);
let head = 0, tail = 1; queue[0] = 0; parent[0] = 0;
while (head < tail) {
  const from = queue[head++];
  for (let e = offsets[from]; e < offsets[from + 1]; e += ef) {
    if (edgeTypes[heap.edges[e + ei.type]] === 'weak') continue;
    const to = heap.edges[e + ei.to_node] / nf;
    if (parent[to] !== -1) continue;
    parent[to] = from; edge[to] = e; queue[tail++] = to;
  }
}
const nodeName = (n: number) => `${types[heap.nodes[n * nf + ni.type]]}:${heap.strings[heap.nodes[n * nf + ni.name]]}#${heap.nodes[n * nf + ni.id]}`;
const pathTo = (n: number) => {
  const path: { from: string; edge: string; to: string }[] = [];
  while (n && parent[n] !== -1) {
    const e = edge[n], from = parent[n], type = edgeTypes[heap.edges[e + ei.type]], key = heap.edges[e + ei.name_or_index];
    path.push({ from: nodeName(from), edge: `${type}:${['element', 'hidden'].includes(type) ? key : heap.strings[key]}`, to: nodeName(n) }); n = from;
  }
  return path.reverse();
};
const report = { input, baseline, nodes: count, strongReachable: tail,
  shallowGroups: [...groups].map(([name, stats]) => ({ name, ...stats })).sort((a,b) => b.bytes - a.bytes).slice(0, 40),
  ...(baseline ? { newGroups: [...newGroups].map(([name, stats]) => ({ name, ...stats })).sort((a,b) => b.bytes - a.bytes).slice(0, 40) } : {}),
  allocations: largest.sort((a,b) => b.bytes-a.bytes).slice(0, 25).map(({ node, bytes }) => {
    const maps: { node: string; keys: string[] }[] = [];
    for (let n = node; n && parent[n] !== -1; n = parent[n]) {
      if (heap.strings[heap.nodes[n * nf + ni.name]] !== 'Map') continue;
      const keys: string[] = [];
      for (let e = offsets[n]; e < offsets[n + 1]; e += ef) {
        if (heap.strings[heap.edges[e + ei.name_or_index]] !== 'table') continue;
        const table = heap.edges[e + ei.to_node] / nf;
        for (let entry = offsets[table]; entry < offsets[table + 1]; entry += ef) {
          const key = heap.edges[entry + ei.to_node] / nf;
          if (types[heap.nodes[key * nf + ni.type]] === 'string') keys.push(heap.strings[heap.nodes[key * nf + ni.name]]);
        }
      }
      maps.push({ node: nodeName(n), keys });
    }
    return { node: nodeName(node), bytes, path: pathTo(node), maps };
  }) };
writeFileSync(process.argv[3] ?? `${input}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ nodes: count, largestGroups: report.shallowGroups.slice(0, 12) }, null, 2));
