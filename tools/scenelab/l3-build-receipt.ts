/** Pin the final build, whole-body source and L1 skin-route budgets together. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const report = 'test-results/skinned-prod/builds/npc.national-guard';
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const build = json(`${report}/build.json`), validation = json(`${report}/validation.json`);
const pipeline = resolve(process.env.CROWD_PIPELINE ?? build.source.slice(0, build.source.lastIndexOf('/cast/')));
const source = `${pipeline}/cast/l3/npc.national-guard/source`;
const contract = json(`${source}/manifest.json`);
assert.deepEqual(build.manualSteps, []);
assert.equal(sha(contract.source_high), contract.source_high_sha256);
for (const [file, digest] of Object.entries(contract.files)) assert.equal(sha(`${source}/${file}`), digest, file);
const lods = [0, 1, 2].map(lod => {
  const rig = json(`${report}/lod${lod}.json`), result = validation[lod];
  assert.deepEqual(result.errors, []);
  assert.ok(result.triangles <= [6000, 2500, 4000][lod]);
  assert.equal(rig.components, 1); assert.equal(rig.openEdges, 0);
  assert.ok(rig.maxInfluences <= 4); assert.equal(rig.zeroNormals, 0);
  assert.ok(rig.propBindings.every((p: { intended: string; owner: string }) => p.intended === p.owner));
  for (const tier of build.receipts[lod].tiers) {
    assert.equal(sha(tier.path), tier.sha256);
    assert.equal(readFileSync(tier.path).length, tier.bytes);
    assert.ok(tier.bytes <= [600000, 250000, 150000][lod]);
  }
  return { lod, triangles: result.triangles, bodyTriangles: rig.triangles,
    components: rig.components, openEdges: rig.openEdges, maxInfluences: rig.maxInfluences,
    unrelatedSeams: rig.unrelatedSeams, propBindings: rig.propBindings,
    regions: json(`${report}/lod${lod}.regions.json`) };
});
const sourcePipelineCommit = execFileSync('git', ['-C', pipeline, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync('docs/reports/l3-all-new/build-integrity.json', JSON.stringify({
  sourcePipelineCommit, sourceContract: contract, build, lods, validation,
  triangleCaps: [6000, 2500, 4000], byteCaps: [600000, 250000, 150000],
}, null, 2) + '\n');
console.log('Whole-body source, six deliveries, closed bodies, prop ownership and L1 budgets verified.');
