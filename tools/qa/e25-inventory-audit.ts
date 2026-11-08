/** Exhaustive shipped-GLB light inventory, including decay and native LOD variants. */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { decorativeEmissive, extractLights, readGltfJson } from '../assets/lights';
const rows: { path: string; sourcePath: string; sourceAvailable: boolean; named: number; metadata: number; anchors: number; errors: string[]; uncertainReferences: string[]; uncoveredEmissive: string[] }[] = [];
for (const filename of readdirSync('public/assets/models').filter(n => n.endsWith('.glb')).sort()) {
  const id = filename.slice(0, -4), suffix = id.match(/((?:\.(?:w\d+|lod[12]|wrecked|burned))+)$/)?.[0] ?? '', base = suffix ? id.slice(0, -suffix.length) : id;
  const path = `public/assets/models/${filename}`, sourcePath = `assets/${base}/model${suffix}.glb`, sourceAvailable = existsSync(sourcePath);
  const json = readGltfJson(path), result = extractLights(json, sourceAvailable ? readGltfJson(sourcePath) : undefined);
  // Optimized nodes lose authored names. Keep such reference errors separate, not factual failures.
  const uncertain = sourceAvailable ? [] : result.errors.filter(e => e.includes('emissive node '));
  rows.push({ path, sourcePath, sourceAvailable, named: json.nodes?.filter(n => n.name?.startsWith('light:')).length ?? 0, metadata: json.nodes?.filter(n => n.extras?.ss_light !== undefined).length ?? 0, anchors: result.anchors.length, errors: result.errors.filter(e => !uncertain.includes(e)), uncertainReferences: uncertain, uncoveredEmissive: result.unreferencedEmissive.filter(n => !decorativeEmissive[base]?.includes(n)) });
}
const total = (key: 'named' | 'metadata' | 'anchors') => rows.reduce((n, r) => n + r[key], 0);
const otherExports = readdirSync('public/assets', { recursive: true }).map(String).filter(p => p.endsWith('.glb') && !p.startsWith('models/')).map(p => { const json = readGltfJson(`public/assets/${p}`); return { path: `public/assets/${p}`, named: json.nodes?.filter(n => n.name?.startsWith('light:')).length ?? 0, metadata: json.nodes?.filter(n => n.extras?.ss_light !== undefined).length ?? 0 }; });
const report = { otherExports, at: new Date().toISOString(), method: 'Every public/assets/models GLB; matching authored decay/LOD source, never hero-source substitution. Missing authored sources are explicitly unresolved.', checked: rows.length, named: total('named'), metadata: total('metadata'), anchors: total('anchors'), errors: rows.flatMap(r => r.errors).length, uncoveredEmissive: rows.flatMap(r => r.uncoveredEmissive).length, missingAuthored: rows.filter(r => !r.sourceAvailable).map(r => r.path), issues: rows.filter(r => r.errors.length || r.uncertainReferences.length || r.uncoveredEmissive.length) };
writeFileSync('docs/reports/e25-verify/evidence/inventory-final.json', JSON.stringify(report, null, 2) + '\n'); console.log({ ...report, otherExports: otherExports.length, issues: report.issues.length, missingAuthored: report.missingAuthored.length });
