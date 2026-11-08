import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const read = name => JSON.parse(gunzipSync(readFileSync(new URL(name, import.meta.url))));
const after = read('after.json.gz');
const baseline = [read('before-l4.json.gz'), read('before-l5-l8.json.gz'), read('before-l3-l7.json.gz')];
const before = id => baseline.flatMap(a => a.levels).find(l => l.level === id);
const final = id => after.levels.find(l => l.level === id);
const fields = ['nativeStateHash', 'run', 'observation', 'passiveRun', 'passiveObservation', 'highHold', 'kiting'];
const l4 = Object.fromEntries(fields.map(field => {
  assert.deepStrictEqual(final('L4')[field], before('L4')[field], `L4 ${field}`);
  return [field, true];
}));
const extra = read('l4-extra-seeds.json.gz');
assert.deepStrictEqual(extra.after, extra.before, 'L4 seeds 2/3 complete native, observation and kiting receipts');
for (const id of ['L5', 'L8']) assert(final(id).kiting.attacksPerMinute >= 2, `${id} kiting floor`);
assert.deepStrictEqual(after.flags.filter(flag => flag !== 'L3/criterion/L3-11 native competent rate:FAIL'), [], 'unexpected full-audit findings');
const phases = receipt => Object.fromEntries(['phase/emerged', 'step/look', 'step/metro'].map(key => {
  const p = receipt.phases.find(p => p.key === key);
  return [key, p && Object.fromEntries(['seconds', 'attacks', 'attacksPerMinute', 'groupAttacks', 'groupAttacksPerMinute', 'firstAttackSeconds'].map(k => [k, p[k]]))];
}));
const normal = l => ({ run: l.run, skilled: phases(l.observation), passive: phases(l.passiveObservation) });
const result = {
  revision: after.revision, flags: after.flags, seconds: after.seconds,
  l4Exact: l4,
  l4ExtraSeedsExact: extra.after.map(row => ({ seed: row.seed, hash: row.nativeStateHash, kitingRate: row.kiting.attacksPerMinute, identical: true })),
  kiting: Object.fromEntries(['L4', 'L5', 'L8'].map(id => [id, { before: before(id).kiting, after: final(id).kiting }])),
  l5Normal: { before: normal(before('L5')), after: normal(final('L5')) },
  l3: { before: before('L3').l3SurvivalSeeds, after: final('L3').l3SurvivalSeeds, army: final('L3').l3Army },
  l7: { beforeFlags: before('L7').followerPace.flags, afterFlags: final('L7').followerPace.flags,
    follower64: { before: before('L7').followerPace.rows.find(r => r.phase === 'step/departure' && r.id === 64),
      after: final('L7').followerPace.rows.find(r => r.phase === 'step/departure' && r.id === 64) } },
};
writeFileSync(new URL('comparison.json', import.meta.url), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify({ l4Exact: true, l5: final('L5').kiting.attacksPerMinute, l8: final('L8').kiting.attacksPerMinute, flags: after.flags }));
