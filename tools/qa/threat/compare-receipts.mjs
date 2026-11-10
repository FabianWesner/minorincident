// Prove two qa:threat output directories carry identical simulation results.
// Usage: node tools/qa/threat/compare-receipts.mjs <before-dir> <after-dir>
// Every L*.json receipt must be deep-equal after removing the wall-clock field `wallSeconds`; native state hashes are listed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [before, after] = process.argv.slice(2);
const strip = value => JSON.parse(JSON.stringify(value, (key, v) => key === 'wallSeconds' ? undefined : v));
let ok = true;
for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']) {
  const a = JSON.parse(readFileSync(join(before, `${level}.json`), 'utf8')), b = JSON.parse(readFileSync(join(after, `${level}.json`), 'utf8'));
  const same = JSON.stringify(strip(a)) === JSON.stringify(strip(b));
  ok &&= same;
  console.log(`${level}: receipt ${same ? 'IDENTICAL' : 'DIFFERENT'}; native state hash before ${a.nativeStateHash} after ${b.nativeStateHash}`);
}
console.log(ok ? 'ALL RECEIPTS IDENTICAL (except wallSeconds)' : 'MISMATCH');
process.exitCode = ok ? 0 : 1;
