/** E25: extract every authored `light:*` anchor (glTF node extras `ss_light`) from the shipped model GLBs,
 * validate it against the §6 contract and write the runtime table `src/data/lightAnchors.json`.
 * `npm run assets:lights` writes, `-- --check` fails when the table is stale or an anchor is invalid. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { glbId, parseLight, type LightAnchor } from '../../src/data/lights';

interface GltfNode { name?: string; children?: number[]; mesh?: number; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; extras?: Record<string, unknown> }
interface Gltf { nodes?: GltfNode[]; scenes?: { nodes: number[] }[]; scene?: number; meshes?: { primitives: { material?: number }[] }[]; materials?: { name?: string }[] }

export function readGltfJson(path: string): Gltf {
  const bytes = readFileSync(path), length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')) as Gltf;
}
const round = (v: number) => Math.round(v * 1000) / 1000 || 0;

/** Anchors in the asset frame plus semantic errors. Unreferenced emi_* meshes are reported separately. */
export function extractLights(json: Gltf, source?: Gltf): { anchors: LightAnchor[]; errors: string[]; unreferencedEmissive: string[] } {
  const nodes = json.nodes ?? [], anchors: LightAnchor[] = [], errors: string[] = [];
  const meshNames = new Set<string>(), emissiveMeshes = new Set<string>();
  const local = (n: GltfNode) => n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(new Vector3(...(n.translation ?? [0, 0, 0])), new Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new Vector3(...(n.scale ?? [1, 1, 1])));
  const visit = (index: number, parent: Matrix4) => {
    const node = nodes[index], world = parent.clone().multiply(local(node)), name = node.name ?? `node${index}`;
    if (node.mesh !== undefined) {
      meshNames.add(name);
      if (json.meshes?.[node.mesh]?.primitives.some(p => p.material !== undefined && json.materials?.[p.material]?.name?.startsWith('emi_'))) emissiveMeshes.add(name);
    }
    if (node.extras?.ss_light !== undefined) {
      const position = new Vector3().setFromMatrixPosition(world);
      // Blender's local -Z becomes the glTF node's local -Y after the +Y-up axis conversion.
      const direction = new Vector3(0, -1, 0).transformDirection(world);
      const parsed = parseLight(name, node.extras.ss_light, position.toArray().map(round) as LightAnchor['position'], direction.toArray().map(round) as LightAnchor['direction']);
      anchors.push(parsed.anchor); errors.push(...parsed.errors);
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const root of json.scenes?.[json.scene ?? 0]?.nodes ?? []) visit(root, new Matrix4());
  // Optimized runtime exports drop mesh node names: check emissive references against the authored source.
  if (source) {
    meshNames.clear(); emissiveMeshes.clear();
    // A reference may name an emissive mesh or the group that holds it (e.g. `lightsBrake`).
    for (const node of source.nodes ?? []) if (node.name) {
      meshNames.add(node.name);
      if (node.mesh === undefined) continue;
      if (source.meshes?.[node.mesh]?.primitives.some(p => p.material !== undefined && source.materials?.[p.material]?.name?.startsWith('emi_'))) emissiveMeshes.add(node.name);
    }
  }
  const referenced = new Set(anchors.flatMap(a => a.emissiveNodes ?? []));
  for (const a of anchors) for (const target of a.emissiveNodes ?? []) if (!meshNames.has(target)) errors.push(`${a.name}: emissive node ${target} is missing`);
  const graph = source ?? json, parents = new Map<string, string>();
  for (const node of graph.nodes ?? []) for (const child of node.children ?? []) { const name = graph.nodes![child].name; if (name && node.name) parents.set(name, node.name); }
  const covered = (name: string): boolean => {
    for (let at: string | undefined = name; at; at = parents.get(at)) if (referenced.has(at) || graph.nodes!.some(n => n.name === at && n.extras?.decorativeEmissive)) return true;
    return false;
  };
  return { anchors, errors, unreferencedEmissive: [...emissiveMeshes].filter(name => !covered(name)).sort() };
}

/** Exports that predate the `decorativeEmissive` flag: amber indicator lenses and a lit door frame/glazing with no
 * light of their own. Listed here (instead of failing) until their Blender scripts set the flag. */
export const decorativeEmissive: Record<string, string[]> = {
  'bld.garage-detached': ['body_emi_windowGlow'], 'bld.house-b': ['door_entry_emi_windowGlow'],
  'veh.sedan-white': ['lampBrakeL_emi_schoolBusYellow', 'lampBrakeR_emi_schoolBusYellow', 'lampHeadL_emi_schoolBusYellow', 'lampHeadR_emi_schoolBusYellow', 'static_emi_schoolBusYellow'],
};
interface ManifestEntry { id: string; glb?: string; sourceGlb?: string; status: string }
export function buildLightTable(manifestPath = 'src/assets/manifest.json') {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestEntry[];
  const table: Record<string, Omit<LightAnchor, 'emissiveNodes'>[]> = {}, errors: string[] = [], unreferenced: Record<string, string[]> = {};
  // Keyed by the shipped GLB (aliases such as veh.wreck share one export); the runtime resolves ids via the manifest.
  for (const glb of [...new Set(manifest.map(asset => asset.glb).filter((glb): glb is string => !!glb?.endsWith('.glb')))].sort()) {
    const id = glbId(glb);
    let json: Gltf;
    try { json = readGltfJson(glb); } catch { continue; }
    let source: Gltf | undefined;
    try { source = readGltfJson(manifest.find(asset => asset.id === id)?.sourceGlb ?? `assets/${id}/model.glb`); } catch { source = undefined; }
    const result = extractLights(json, source);
    if (!result.anchors.length) continue;
    table[id] = result.anchors.map(anchor => { const shipped = { ...anchor }; delete shipped.emissiveNodes; return shipped; });
    errors.push(...result.errors.map(e => `${id} ${e}`));
    const missing = result.unreferencedEmissive.filter(name => !decorativeEmissive[id]?.includes(name));
    if (missing.length) { unreferenced[id] = missing; errors.push(...missing.map(name => `${id} emissive mesh ${name} has no light anchor (reference it or flag decorativeEmissive)`)); }
  }
  return { table, errors, unreferenced };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { table, errors, unreferenced } = buildLightTable(), out = 'src/data/lightAnchors.json';
  const text = JSON.stringify(table) + '\n', count = Object.values(table).reduce((sum, list) => sum + list.length, 0);
  console.log(`${count} light anchors in ${Object.keys(table).length} assets; ${errors.length} errors; ${Object.values(unreferenced).flat().length} unreferenced emissive meshes`);
  for (const error of errors) console.error(error);
  if (process.argv.includes('--check')) { if (readFileSync(out, 'utf8') !== text) { console.error(`${out} is stale: run npm run assets:lights`); process.exit(1); } }
  else writeFileSync(out, text);
  if (errors.length) process.exit(1);
}
