/** Exhaustive AC02 audit: validate shipped nodes directly, and each available authored variant independently. */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { extractLights, lightSourcePath, readGltfJson } from '../assets/lights';

function inspect(path: string) {
  const json = readGltfJson(path), result = extractLights(json);
  const named = json.nodes?.filter(n => n.name?.startsWith('light:')).length ?? 0, metadata = json.nodes?.filter(n => n.extras?.ss_light !== undefined).length ?? 0;
  const errors = [...result.errors];
  if (named !== result.anchors.length || metadata !== result.anchors.length) errors.push(`anchor traversal mismatch: ${named} named / ${metadata} metadata / ${result.anchors.length} parsed`);
  return { path, named, metadata, anchors: result.anchors.length, errors, uncoveredEmissive: result.unreferencedEmissive,
    decorative: json.nodes?.flatMap((n, i) => n.extras?.decorativeEmissive ? [{ name: n.name ?? `node${i}`, reason: n.extras.decorativeEmissive }] : []) ?? [] };
}
const rows = readdirSync('public/assets/models').filter(n => n.endsWith('.glb')).sort().map(filename => {
  const sourcePath = lightSourcePath(filename);
  return { ...inspect(`public/assets/models/${filename}`), sourcePath: sourcePath ?? null, source: sourcePath ? inspect(sourcePath) : null };
});
const otherExports = readdirSync('public/assets', { recursive: true }).map(String).filter(p => p.endsWith('.glb') && !/^models\/[^/]+\.glb$/.test(p)).sort().map(p => inspect(`public/assets/${p}`));
const all = [...rows, ...otherExports], sources = rows.flatMap(r => r.source ? [r.source] : []);
const report = { at: new Date().toISOString(), method: 'Every exported GLB validates against its own active-scene nodes, including unnamed emissive meshes. Every available matching authored variant is independently validated. No authored substitution or uncertain-reference suppression.',
  checked: rows.length, otherChecked: otherExports.length, named: all.reduce((n, r) => n + r.named, 0), metadata: all.reduce((n, r) => n + r.metadata, 0), anchors: all.reduce((n, r) => n + r.anchors, 0),
  errors: all.flatMap(r => r.errors).length, missingEmitterReferences: all.flatMap(r => r.errors).filter(e => e.includes('emissive node ')).length, uncoveredEmissive: all.flatMap(r => r.uncoveredEmissive).length,
  sourceErrors: sources.flatMap(r => r.errors).length, sourceUncoveredEmissive: sources.flatMap(r => r.uncoveredEmissive).length,
  missingAuthored: rows.filter(r => !r.source).map(r => r.path), issues: rows.filter(r => r.errors.length || r.uncoveredEmissive.length || r.source?.errors.length || r.source?.uncoveredEmissive.length), rows, otherExports };
const out = process.env.E25_INVENTORY_OUT ?? 'test-results/epics/E25/emitters-inventory-final.json';
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log({ ...report, missingAuthored: report.missingAuthored.length, issues: report.issues.length, rows: report.rows.length, otherExports: report.otherExports.length, out });
if (process.argv.includes('--check') && (report.errors || report.uncoveredEmissive || report.sourceErrors || report.sourceUncoveredEmissive || otherExports.some(r => r.errors.length || r.uncoveredEmissive.length))) process.exitCode = 1;
