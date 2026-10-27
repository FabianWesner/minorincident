// Regression-injection check for the test rewrite (docs/qa/test-strategy.md): apply one representative bug at a time to
// src/ (or the asset manifest), run the per-change suite, record which tests catch it, restore the file.
// Usage: node tools/qa/inject-regressions.mjs [id...]   → test-results/inject/summary.json
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const injections = [
  { id: 'determinism', what: 'RNG state leaks across worlds (a module counter shifts every 97th draw)', file: 'src/core/Rng.ts',
    from: '    return ((t ^ t >>> 14) >>> 0) / 4294967296;', to: '    return (((t ^ t >>> 14) >>> 0) / 4294967296 + (++leak % 97 === 0 ? .5 : 0)) % 1;', prepend: 'let leak = 0;\n' },
  { id: 'save-carry', what: 'the handover rack cap cuts carried weapons to three per side (P1 10-20 "I lost the shotgun" mechanism)', file: 'src/sim/progression/carryover.ts',
    from: '  save.racks = { LEFT: racks.LEFT.slice(0, carriedRackMax), RIGHT: racks.RIGHT.slice(0, carriedRackMax) };', to: '  save.racks = { LEFT: racks.LEFT.slice(0, carriedRackMax - 3), RIGHT: racks.RIGHT.slice(0, carriedRackMax - 3) };' },
  { id: 'aim', what: 'keyboard aim assist mirrors the cross-track sign (Q-196 class)', file: 'src/sim/combat/AimAssist.ts',
    from: 'const along = dx * aim.x + dz * aim.z, score = Math.abs(dx * aim.z - dz * aim.x) + along * .05;', to: 'const along = dx * aim.x - dz * aim.z, score = Math.abs(dx * aim.z + dz * aim.x) + along * .05;' },
  { id: 'collision', what: 'nav clearance ignores half of the body radius against walls', file: 'src/sim/ai/NavGrid.ts',
    from: 'Math.abs(x - w.x) < w.halfX + radius && Math.abs(z - w.z) < w.halfZ + radius) return false;', to: 'Math.abs(x - w.x) < w.halfX + radius * .5 && Math.abs(z - w.z) < w.halfZ + radius * .5) return false;' },
  { id: 'spawn-admission', what: 'the director no longer keeps 18 m from the courier', file: 'src/sim/ai/SpawnDirector.ts',
    from: 'Math.hypot(target.x - player.transform.x, target.z - player.transform.z) >= 18 &&', to: 'Math.hypot(target.x - player.transform.x, target.z - player.transform.z) >= 0 &&' },
  { id: 'gpu-limits', what: 'frozen corpse pages stop interleaving their surface (one vertex buffer per attribute, Q-201 class)', file: 'src/render/characters/StaticCorpses.ts',
    from: '    if (shared) for (const [name, attribute] of Object.entries(shared)) geometry.setAttribute(name, attribute);\n    else { interleaveCrowdSurface(geometry); interleavedSurfaces.set(frozen.geometry, { ...geometry.attributes }); }', to: '    void shared;' },
  { id: 'asset-contract', what: 'a shipped prop points one LOD at a missing file', file: 'src/assets/manifest.json', json: true },
  { id: 'skinned', what: 'skinned crowd packing normalizes the extra influences without the dominant weight', file: 'src/render/characters/skinnedCrowd.ts',
    from: '    const sum = w[0] + w[1] + w[2] + w[3] || 1;', to: '    const sum = w[1] + w[2] + w[3] || 1;' },
];

function apply(injection, text) {
  if (injection.json) {
    const manifest = JSON.parse(text), prop = manifest.find(a => a.category === 'prop' && a.lods?.lod1);
    prop.lods.lod1 = prop.lods.lod1.replace(/\.glb$/, '.missing.glb'); injection.what += ` (${prop.id})`;
    return JSON.stringify(manifest, null, 2) + '\n';
  }
  if (text.split(injection.from).length !== 2) throw new Error(`${injection.id}: anchor not found exactly once in ${injection.file}`);
  return (injection.prepend ?? '') + text.replace(injection.from, injection.to);
}

const wanted = process.argv.slice(2), results = [];
mkdirSync('test-results/inject', { recursive: true });
for (const injection of injections.filter(i => !wanted.length || wanted.includes(i.id))) {
  const original = readFileSync(injection.file, 'utf8'), out = `test-results/inject/${injection.id}.json`;
  try {
    writeFileSync(injection.file, apply(injection, original));
    spawnSync('npx', ['vitest', 'run', '--project', 'default', '--configLoader', 'runner', '--maxWorkers=3', '--reporter=dot', '--reporter=json', `--outputFile=${out}`], { stdio: 'inherit' });
  } finally { writeFileSync(injection.file, original); }
  const report = JSON.parse(readFileSync(out, 'utf8'));
  const failed = report.testResults.flatMap(file => file.assertionResults.filter(t => t.status === 'failed').map(t => `${file.name.replace(/^.*\/tests\//, 'tests/')} › ${t.title}`));
  results.push({ id: injection.id, what: injection.what, file: injection.file, caught: failed.length > 0, failed });
  console.log(`[inject] ${injection.id}: ${failed.length ? `caught by ${failed.length}` : 'NOT CAUGHT'}`);
  writeFileSync('test-results/inject/summary.json', JSON.stringify(results, null, 2) + '\n');
}
process.exitCode = results.every(r => r.caught) ? 0 : 1;
