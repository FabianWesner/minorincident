import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reusableBrowserReceipt } from './browser';
import { atomicJson } from './report';
import { mergeBrowserBatches, type BrowserReceipt } from './browser-chain';

const template = JSON.parse(readFileSync('docs/reports/fix51-r4/attempts/L10-low-initial.json', 'utf8')) as BrowserReceipt;
function fixture(index: number, finished: boolean): { path: string; receipt: BrowserReceipt } {
  const receipt = structuredClone(template);
  receipt.errors = []; receipt.issues = [];
  receipt.run = [{ ...receipt.run[0], level: 'L10', finished, skipped: [], wallSeconds: 480, simSeconds: 480, steps: [], attacks: {} }];
  receipt.batch = { index, yielded: !finished, startSaveHash: index === 1 ? null : `save-${index-1}`, endSaveHash: finished ? null : `save-${index}`,
    startSeconds: index === 1 ? null : (index-1)*480, endSeconds: index*480, savePath: finished ? null : `save-${index}.json.gz` };
  return { path: `batch-${index}.json`, receipt };
}
const actualPrefix = JSON.parse(readFileSync('docs/reports/fix51-verify/receipts/L10-low-browser-batch1.json', 'utf8')) as BrowserReceipt;
assert(actualPrefix.checks.length && !actualPrefix.errors.length && actualPrefix.checks.some(check => check.status !== 'PASS'), 'retained actual unfinished prefix reproduced the old reuse predicate');
assert.equal(reusableBrowserReceipt(actualPrefix, actualPrefix.sourceHash, actualPrefix.browserHash), false);
const completedReuse = structuredClone(actualPrefix); completedReuse.checks.forEach(check => { check.status = 'PASS'; });
assert.equal(reusableBrowserReceipt(completedReuse, completedReuse.sourceHash, completedReuse.browserHash), true);
const good = [fixture(1, false), fixture(2, true)];
assert.equal(mergeBrowserBatches(good, 'result').checks[0].status, 'PASS');
const unavailable = fixture(1, false); unavailable.receipt.run = []; unavailable.receipt.batch = undefined; unavailable.receipt.errors = ['Browser admission failed before gameplay'];
assert.equal(mergeBrowserBatches([unavailable], 'result').checks[0].status, 'NOT CHECKED', 'failed admission is unmeasured gameplay');
const cases: { name: string; mutate: (items: typeof good) => void }[] = [
  { name: 'tail without the full-level start', mutate: items => items.splice(0, 1) },
  { name: 'unrelated Resume save', mutate: items => { items[1].receipt.batch!.startSaveHash = 'other'; } },
  { name: 'failed predecessor', mutate: items => { items[0].receipt.batch!.yielded = false; } },
  { name: 'no mission-time progress', mutate: items => { items[0].receipt.batch!.endSeconds = 0; } },
  { name: 'missing production save', mutate: items => { items[0].receipt.batch!.savePath = null; } },
  { name: 'changed game', mutate: items => { items[1].receipt.sourceHash = 'other'; } },
  { name: 'changed observer', mutate: items => { items[1].receipt.browserHash = 'other'; } },
  { name: 'changed backend', mutate: items => { items[1].receipt.backend = 'webgpu'; } },
  { name: 'changed quality', mutate: items => { items[1].receipt.tier = 'high'; } },
  { name: 'changed zoom', mutate: items => { items[1].receipt.zoom = .5; } },
  { name: 'missing route', mutate: items => { items[1].receipt.run = []; } },
  { name: 'skipped objective', mutate: items => { items[0].receipt.run[0].skipped = ['research']; } },
  { name: 'unfinished last batch', mutate: items => { items[1] = fixture(2, false); } },
  { name: 'console error in earlier batch', mutate: items => { items[0].receipt.issues = [{ kind: 'console-error' } as BrowserReceipt['issues'][number]]; } },
];
const results = cases.map(({ name, mutate }) => {
  const items = structuredClone(good); mutate(items);
  const result = mergeBrowserBatches(items, 'result');
  assert.notEqual(result.checks[0].status, 'PASS', name);
  return { name, status: result.checks[0].status, errors: result.errors };
});
atomicJson('docs/reports/fix51-r5c/browser-chain-proof.json', { reuse: 'Actual unfinished L10 batch1 matched the former predicate and is rejected; a completed identity-matching control remains reusable', control: 'two connected batches PASS', admissionFailure: 'NOT CHECKED; no gameplay result', brokenCasesDetected: results.length, results });
console.log(`PASS: connected batches qualify; all ${results.length} broken chains remain unqualified`);
