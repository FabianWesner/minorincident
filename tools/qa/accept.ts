import { l10FramingReceipts } from './accept/l10-framing-receipts';
import { l7RouteReceipts } from './accept/l7-route-receipts';
import { l7CorridorReceipts } from './accept/l7-corridor-receipts';
import { l7DepartureReceipts } from './accept/l7-departure-receipts';
import { l7ReadabilityReceipts } from './accept/l7-readability-receipts';
import { l9WedgeReceipts } from './accept/l9-wedge-receipts';
import { l9StreamReceipts } from './accept/l9-stream-receipts';
import { l9ArrivalReceipts } from './accept/l9-arrival-receipts';
import { l8AnimalReceipts } from './accept/l8-animal-receipts';
import { l8BreachReceipts } from './accept/l8-breach-receipts';
import { l8PopulationReceipts } from './accept/l8-population-receipts';
import { l9DetourReceipts } from './accept/l9-detour-receipts';
import { l8HandoverReceipts } from './accept/l8-handover-receipts';
import { l8BoardingReceipts } from './accept/l8-boarding-receipts';
import { l10PresentationReceipts } from './accept/l10-presentation-receipts';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runnerLevels } from '../sim-runner/levels';
import { probeLevel, provenance, type NativeReceipt, type Tier } from './accept/probe';
import { atomicJson, buildLevelReport, reportRoot, writeIndexes } from './accept/report';
import { fixtureHash, runFixtures, type FixtureReceipt } from './accept/fixtures';
import { checkpointHash, checkpointProbe, type CheckpointReceipt } from './accept/checkpoints';
import { browserHash, browserProbes } from './accept/browser';
import { fix55RocketReceipts } from './accept/fix55-rocket-receipts';
import { fix55L9Receipts } from './accept/fix55-l9-receipts';
import { fix55L10EndingReceipts } from './accept/fix55-l10-ending-receipts';
import { l9RouteReceipts } from './accept/l9-route-receipts-r10';
import { l8CalmReceipts } from './accept/l8-calm-receipts-r10';
import { l8ArrivalReceipts } from './accept/l8-arrival-receipts-r10';
import { sweepC4L10CureReceipts } from './accept/sweep-c4-l10-cure-receipts';
import { l10CureReceipts } from './accept/l10-cure-receipts-r10';
import { l10DogReceipts } from './accept/l10-dog-receipts-r10';
import { sweepC3L9Receipts } from './accept/sweep-c3-l9-receipts';
import { sweepC4L9RouteReceipts } from './accept/sweep-c4-l9-route-receipts';
import { l9GroupCensusReceipts } from './accept/l9-group-census-receipts';

const { values } = parseArgs({ options: { level: { type: 'string' }, reuse: { type: 'boolean' }, browser: { type: 'boolean' }, 'skip-browser': { type: 'boolean' }, tier: { type: 'string', default: 'both' }, policy: { type: 'string', default: 'both' }, backend: { type: 'string', default: 'webgl2' }, zoom: { type: 'string', default: '1.5' } } });
const selected = values.level === 'all' ? [...runnerLevels] : runnerLevels.filter(level => level === values.level);
if (!selected.length || !['both', 'low', 'high'].includes(values.tier!) || !['both', 'complete', 'stationary'].includes(values.policy!) || !['webgl2', 'webgpu'].includes(values.backend!) || !['0.5', '1.5'].includes(values.zoom!) || values.browser && values['skip-browser']) throw new Error('Usage: npm run qa:accept -- --level L1|all [--reuse] [--skip-browser] [--tier both|low|high] [--policy both|complete|stationary] [--backend webgl2|webgpu] [--zoom 0.5|1.5]');
const tiers: Tier[] = values.tier === 'both' ? ['low', 'high'] : [values.tier as Tier];
const policies: NativeReceipt['policy'][] = values.policy === 'both' ? ['complete', 'stationary'] : [values.policy as NativeReceipt['policy']];
const identity = provenance();
let failed = false, incomplete = false;
for (const level of selected) {
  for (const tier of tiers) for (const policy of policies) {
    const path = join(reportRoot, 'receipts', `${level}-${tier}-${policy}.json`);
    const saved = values.reuse && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as NativeReceipt : null;
    if (saved?.version === 2 && saved.sourceHash === identity.sourceHash && saved.observerHash === identity.observerHash && saved.level === level && saved.tier === tier && saved.policy === policy && !saved.error && saved.run && saved.observation && saved.threat) {
      console.log(`[qa:accept] ${level} ${tier}/${policy}: reuse matching receipt`);
    } else {
      console.log(`[qa:accept] ${level} ${tier}/${policy}: native global and level observation`);
      const receipt = await probeLevel(level, tier, policy, identity);
      atomicJson(path, receipt);
      console.log(`[qa:accept] ${level} ${tier}/${policy}: ${receipt.run?.outcome ?? 'error'}${receipt.error ? `; ${receipt.error}` : ''}`);
    }
  }
  const receipts: { path: string; receipt: NativeReceipt }[] = [];
  for (const tier of ['low', 'high']) for (const policy of ['complete', 'stationary']) {
    const path = join(reportRoot, 'receipts', `${level}-${tier}-${policy}.json`);
    if (!existsSync(path)) continue;
    const receipt = JSON.parse(readFileSync(path, 'utf8')) as NativeReceipt;
    if (receipt.sourceHash === identity.sourceHash && receipt.observerHash === identity.observerHash) receipts.push({ path, receipt });
  }
  const fixtures: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of tiers) {
    const path = join(reportRoot, 'receipts', `${level}-${tier}-fixtures.json`);
    const saved = values.reuse && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as FixtureReceipt : null;
    const receipt = saved?.sourceHash === identity.sourceHash && saved.fixtureHash === fixtureHash() && saved.level === level && saved.tier === tier && !saved.errors.length ? saved : await runFixtures(level, tier, identity.sourceHash, path);
    atomicJson(path, receipt); fixtures.push({ path, receipt });
    console.log(`[qa:accept] ${level} ${tier}/fixtures: ${receipt.checks.length} clauses, ${receipt.errors.length} errors`);
  }
  for (const tier of tiers) {
    const native = receipts.find(item => item.receipt.tier === tier && item.receipt.policy === 'complete')?.receipt;
    if (!native?.nativeStateHash) continue;
    const path = join(reportRoot, 'receipts', `${level}-${tier}-checkpoints.json`);
    const saved = values.reuse && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as CheckpointReceipt : null;
    const receipt = saved?.sourceHash === identity.sourceHash && saved.fixtureHash === fixtureHash() && saved.checkpointHash === checkpointHash() && saved.control.observed === native.nativeStateHash && !saved.errors.length ? saved : await checkpointProbe(native, path, fixtureHash());
    atomicJson(path, receipt); fixtures.push({ path, receipt });
    console.log(`[qa:accept] ${level} ${tier}/checkpoints: ${receipt.checks.length} clauses; control ${receipt.control.identical ? 'identical' : 'DIFFERS'}; ${receipt.errors.length} errors`);
  }
  if (!values['skip-browser']) fixtures.push(...await browserProbes(level, tiers, identity.sourceHash, !!values.reuse, { backend: values.backend as 'webgl2' | 'webgpu', zoom: Number(values.zoom) as .5 | 1.5 }));
  // Retain every matching backend/zoom result, including when a later native
  // run is requested without a browser. Each receipt states its actual matrix cell.
  for (const file of readdirSync(join(reportRoot, 'receipts')).filter(file => new RegExp(`^${level}-(low|high)(-(webgl2|webgpu)-z(0\\.5|1\\.5))?-browser\\.json$`).test(file))) {
    const path = join(reportRoot, 'receipts', file);
    if (fixtures.some(item => item.path === path)) continue;
    const receipt = JSON.parse(readFileSync(path, 'utf8')) as FixtureReceipt & { browserHash: string };
    if (receipt.sourceHash === identity.sourceHash && receipt.browserHash === browserHash()) fixtures.push({ path, receipt });
  }
  if (level === 'L10') fixtures.push(...l10FramingReceipts(identity.sourceHash, browserHash()));
  if (level === 'L8') fixtures.push(...l8AnimalReceipts(identity.sourceHash, browserHash()), ...l8BreachReceipts(identity.sourceHash, browserHash()), ...l8PopulationReceipts(identity.sourceHash, browserHash()), ...l8HandoverReceipts(identity.sourceHash, browserHash()), ...l8BoardingReceipts(identity.sourceHash, identity.observerHash, browserHash()), ...l8CalmReceipts(identity.sourceHash, browserHash()), ...l8ArrivalReceipts(identity.sourceHash, browserHash()));
  if (level === 'L7') fixtures.push(...l7CorridorReceipts(identity.sourceHash, identity.observerHash, browserHash()), ...l7DepartureReceipts(identity.sourceHash, browserHash()), ...l7RouteReceipts(identity.sourceHash, browserHash()), ...l7ReadabilityReceipts(identity.sourceHash, browserHash()), ...fix55RocketReceipts(identity.sourceHash, browserHash()));
  if (level === 'L9') fixtures.push(...l9WedgeReceipts(identity.sourceHash, identity.observerHash, browserHash()), ...l9StreamReceipts(identity.sourceHash, identity.observerHash, browserHash()), ...l9ArrivalReceipts(identity.sourceHash, browserHash()), ...l9DetourReceipts(identity.sourceHash, browserHash()), ...l9RouteReceipts(identity.sourceHash, browserHash()), ...fix55L9Receipts(identity.sourceHash), ...l9GroupCensusReceipts(identity.sourceHash), ...sweepC3L9Receipts(identity.sourceHash, browserHash()), ...sweepC4L9RouteReceipts(identity.sourceHash, browserHash()), ...sweepC4L9RouteReceipts(identity.sourceHash, browserHash(), 'docs/reports/fix65-c'), ...sweepC4L9RouteReceipts(identity.sourceHash, browserHash(), 'docs/reports/sweep-c5/L9-04'));
  if (level === 'L10') fixtures.push(...l10PresentationReceipts(identity.sourceHash, browserHash()), ...l10CureReceipts(identity.sourceHash, browserHash()), ...sweepC4L10CureReceipts(identity.sourceHash, browserHash()), ...l10DogReceipts(identity.sourceHash, browserHash()), ...fix55L10EndingReceipts(identity.sourceHash, browserHash(), 3), ...fix55L10EndingReceipts(identity.sourceHash, browserHash(), 4));
  const report = buildLevelReport(level, receipts, fixtures, checkpointHash());
  atomicJson(join(reportRoot, `${level}.json`), report);
  failed ||= report.policies.some(policy => !!policy.error) || [...report.globals, ...report.rows].some(row => row.status === 'FAIL');
  incomplete ||= [...report.globals, ...report.rows].some(row => row.status === 'NOT CHECKED');
  writeIndexes({ ...identity, fixtureHash: fixtureHash(), checkpointHash: checkpointHash() });
  console.log(`[qa:accept] ${level}: ${report.rows.filter(row => row.currentStatus === 'FAIL').length} fresh failing rows; ${report.rows.filter(row => row.currentStatus === 'NOT CHECKED').length} incomplete rows; ${join(reportRoot, `${level}.json`)}`);
}
process.exitCode = failed ? 1 : incomplete ? 2 : 0;
