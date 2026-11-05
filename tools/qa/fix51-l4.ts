/** Both-tier native hold/escape receipts, independent of the browser driver. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { L4HoldCensus } from './threat/l4-hold';
import { ThreatObserver } from './threat/observer';

const out = process.env.QA_OUT ?? 'test-results/fix51-p1/l4-native';
mkdirSync(out, { recursive: true });
const receipts: { tier: string; policy: string; run: unknown; evidence: unknown }[] = existsSync(`${out}/receipt.json`) ? JSON.parse(readFileSync(`${out}/receipt.json`, 'utf8')) : [];
for (const tier of ['low', 'high'] as const) for (const passive of [false, true]) {
  const policy = passive ? 'stationary passive hold, native escape route' : 'competent mortal native route';
  if (receipts.some(r => r.tier === tier && r.policy === policy)) continue;
  let census: L4HoldCensus | undefined, observer: ThreatObserver | undefined;
  let evidence: unknown;
  const run = await runLevel('L4', 'complete', 1, passive ? 250 : 600, 'auto', undefined, undefined, 0, {
    quality: tier, passive,
    beforeBegin: w => { observer = new ThreatObserver(w, 'L4'); census = new L4HoldCensus(w); },
    beforeDispose: w => {
      evidence = { census: census!.finish(), observation: observer!.finish(), controller: structuredClone(w.missions!.state.l4) };
    },
  });
  receipts.push({ tier, policy, run, evidence });
  writeFileSync(`${out}/receipt.json`, JSON.stringify(receipts, null, 2) + '\n');
  console.log(JSON.stringify({ tier, passive, outcome: run.outcome, deaths: run.deaths }));
}
