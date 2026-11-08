/** Preserve authored decorative decisions and finish known material-batch emitter bindings. */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { bindEmitter, writeMetadata, type MetadataProof } from './e25-emitter-repair';
import { decorativeEmissive, extractLights, lightSourcePath, readGltfJson, type Gltf, type GltfNode } from './lights';
const materialNames = (g: Gltf, n: GltfNode) => n.mesh === undefined ? [] : g.meshes![n.mesh].primitives.flatMap(p => p.material === undefined ? [] : [g.materials![p.material].name ?? '']);
const children = (g: Gltf, n: GltfNode): GltfNode[] => [n, ...(n.children ?? []).flatMap(i => children(g, g.nodes![i]))];
const proofs: MetadataProof[] = [], decisions: unknown[] = [];
const files = readdirSync('public/assets/models').filter(n => n.endsWith('.glb')).sort();
const paths = [...new Set(files.flatMap(f => { const source = lightSourcePath(f); return source ? [source] : []; })), ...files.map(f => `public/assets/models/${f}`)];
for (const path of paths) {
  const g = readGltfJson(path), before = structuredClone(g), authored = path.startsWith('public/') ? lightSourcePath(path) : path;
  const base = authored?.split('/')[1] ?? path.split('/').at(-1)!.slice(0, -4), sources: { path: string; json: Gltf }[] = [{ path, json: before }];
  if (authored && authored !== path) sources.push({ path: authored, json: readGltfJson(authored) });
  for (const p of [authored?.replace(/\.lod[12]/, ''), authored?.replace(/\/model.*\.glb$/, '/model.glb')]) if (p && existsSync(p) && !sources.some(s => s.path === p)) sources.push({ path: p, json: readGltfJson(p) });
  const bindings: MetadataProof['bindings'] = [];
  for (const n of g.nodes ?? []) {
    const raw = n.extras?.ss_light; if (!raw) continue;
    const light = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
    const suffix = n.name?.replace(/^light:/, '').replace(/\.\d{3}$/, '') ?? '';
    let groups: string[] = [];
    if (['veh.sedan-blue', 'veh.sedan-red'].includes(base)) groups = suffix.startsWith('brake') ? ['lightsBrake'] : suffix.startsWith('head') ? ['lightsFront'] : [];
    if (base === 'veh.police-suv' && suffix.startsWith('brake')) groups = ['lightsBrake'];
    if (base === 'bld.courier-depot' && suffix === 'shop') groups = ['window_side'];
    const next = [...new Set([...(light.emissiveNodes ?? []), ...groups.filter(name => g.nodes?.some(n => n.name === name && children(g, n).some(c => materialNames(g, c).some(m => m.startsWith('emi_')))))])];
    if (JSON.stringify(next) !== JSON.stringify(light.emissiveNodes)) {
      bindings.push({ anchor: n.name!, before: light.emissiveNodes ?? [], after: next }); light.emissiveNodes = next;
      n.extras!.ss_light = typeof raw === 'string' ? JSON.stringify(light) : light;
    }
  }
  // These are material effects, not lamps: eyes have a dedicated runtime shader;
  // the minigun's heat sleeve is hidden/scaled by the overheating mechanic.
  for (const [index, n] of (g.nodes ?? []).entries()) {
    const mats = materialNames(g, n);
    let reason: string | undefined;
    if (base.startsWith('inf.') && (mats.includes('emi_infectedEye') || base === 'inf.sprinter' && mats.includes('emi_windowGlow'))) reason = 'Infected eye signal; CrowdView/CivilianMaterial owns the eye emissive, with no practical light spill.';
    if (base === 'wpn.minigun-mounted' && mats.includes('emi_orange')) reason = 'Heat sleeve; the minigun overheating mechanic owns its visibility and glow, not a steady lamp.';
    if (reason && !n.extras?.decorativeEmissive) { (n.extras ??= {}).decorativeEmissive = reason; decisions.push({ path, node: n.name ?? `node${index}`, reason }); }
  }
  for (const source of sources) {
    const decorated = structuredClone(source.json);
    for (const [index, n] of (decorated.nodes ?? []).entries()) {
      const legacy = !!n.name && decorativeEmissive[base]?.includes(n.name);
      if (!n.extras?.decorativeEmissive && !legacy) continue;
      const originalName = n.name ?? `node${index}`; n.name ??= `decorative:${index}`;
      const projected = structuredClone(g), resolved = bindEmitter(projected, n.name, [decorated]);
      const selected = new Set(resolved.flatMap(name => { const at = projected.nodes?.find(n => n.name === name); return at ? children(projected, at).map(n => projected.nodes!.indexOf(n)) : []; }));
      const uncovered = new Set(extractLights(g).unreferencedEmissive);
      for (const i of selected) {
        const node = g.nodes![i]; if (!uncovered.has(node.name ?? `node${i}`)) continue;
        const reason = `Authored decorative surface ${source.path}:${originalName}${legacy ? ' (existing decorativeEmissive table)' : ''}; no separate practical light.`;
        (node.extras ??= {}).decorativeEmissive = reason; decisions.push({ path, node: node.name ?? `node${i}`, source: source.path, sourceNode: originalName, reason });
      }
    }
  }
  const proof = writeMetadata(path, g, before, bindings); if (proof) proofs.push(proof);
}
const out = process.env.E25_COVERAGE_OUT ?? 'docs/reports/e25-emitters/evidence/coverage-repair.json';
if (proofs.length || !existsSync(out)) writeFileSync(out, JSON.stringify({ files: proofs, decisions }, null, 2) + '\n');
console.log({ files: proofs.length, bindings: proofs.flatMap(p => p.bindings).length, decorativeDecisions: decisions.length, out });
