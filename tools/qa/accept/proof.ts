import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { evaluate } from './evaluate';
import { atomicJson, reportRoot, rowResult, sourceRows } from './report';
import { provenance, type NativeReceipt } from './probe';
import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { newCampaign, preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { validateReview, type ReviewDecision } from './reviews';

const { values } = parseArgs({ options: { control: { type: 'string' } } });
const identity = provenance();
const read = (level: string, policy = 'complete') => JSON.parse(readFileSync(`${reportRoot}/receipts/${level}-low-${policy}.json`, 'utf8')) as NativeReceipt;
const receipts = new Map(Array.from({ length: 10 }, (_, i) => [`L${i + 1}`, read(`L${i + 1}`)]));
for (const r of receipts.values()) { assert.equal(r.sourceHash, identity.sourceHash, 'fixture receipt must match game'); assert.equal(r.observerHash, identity.observerHash, 'fixture receipt must match observer'); }

if (values.control) {
  const results: { level: string; observed: string | null; control: string | null; identical: boolean }[] = [];
  for (const level of values.control.split(',') as RunnerLevel[]) {
    const observed = receipts.get(level); assert(observed, `unknown level ${level}`);
    const campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
    campaign.settings.quality = 'low'; let control: string | null = null;
    await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: 'low', beforeDispose: world => { control = stateHash(world.getState()); } });
    const result = { level, observed: observed.nativeStateHash, control, identical: !!control && control === observed.nativeStateHash };
    results.push(result); console.log(`[qa:accept:control] ${level}: ${result.identical ? 'identical' : 'DIFFERENT'}`);
  }
  atomicJson(`${reportRoot}/control-proof.json`, { ...identity, results });
  assert(results.every(result => result.identical), 'observation must not change native state');
} else {
  const results: { name: string; id: string; clause: string; detected: boolean }[] = [];
  const reviewFixture = JSON.parse(readFileSync('docs/qa/reviews/L5-11.json', 'utf8'));
  for (const [name, mutate] of [
    ['review missing evidence hash', (x: ReviewDecision) => { x.evidence[0].sha256 = ''; }],
    ['review unknown row', (x: ReviewDecision) => { x.row = 'L99-99'; }],
    ['review FAIL clause contradicts PASS', (x: ReviewDecision) => { x.clauses[0].verdict = 'FAIL'; }],
  ] as const) {
    const bad = structuredClone(reviewFixture) as ReviewDecision; mutate(bad);
    let detected = false; try { validateReview(bad); } catch { detected = true; }
    results.push({ name, id: 'L5-11', clause: name, detected }); assert(detected, `${name} must be rejected`);
  }
  function fixture(name: string, level: string, id: string, clause: string, prepare: (r: NativeReceipt) => void, breakIt: (r: NativeReceipt) => void) {
    const good = structuredClone(receipts.get(level)!); prepare(good);
    const find = (r: NativeReceipt) => evaluate(r, 'broken-fixture').find(check => check.id === id && check.clause === clause)?.status;
    assert.equal(find(good), 'PASS', `${name}: known-good fixture`);
    const bad = structuredClone(good); breakIt(bad);
    const detected = find(bad) === 'FAIL'; results.push({ name, id, clause, detected });
    assert(detected, `${name}: deliberately broken fixture must fail`);
  }
  fixture('infected cap boundary', 'L1', 'G-05', 'native concurrent infected peak (no frame/performance measurement)', r => { r.observation!.peakAlive = 100; }, r => { r.observation!.peakAlive = 101; });
  fixture('moving objective anchor', 'L1', 'G-08', 'fixed anchor positions during the observed native route', r => { r.observation!.markers = [{ id: 'door', x: 0, z: 0, samples: 100, maxDisplacement: 0 }]; }, r => { r.observation!.markers[0].maxDisplacement = .02; });
  fixture('ground pickup distance', 'L1', 'G-10', 'observed approach collection distances; E-free causality needs an input fixture', r => { r.observation!.pickups = [{ id: 2, tick: 10, item: 'weapon.bat', collector: 1, distance: 1.5, shelf: false, interact: false, speed: 4 }]; }, r => { r.observation!.pickups[0].distance = 1.51; });
  fixture('duplicate pickup transaction', 'L1', 'G-11', 'duplicate pickup transactions since the last restore', r => { r.observation!.duplicatePickups = []; }, r => { r.observation!.duplicatePickups = [2]; });
  fixture('slow individual follower', 'L1', 'G-13', 'each observed follower median versus its phase group median', r => { r.threat!.phases = [{ ...r.threat!.phases[0], key: 'step/proof', followerSpeeds: [2, 3, 4].map(id => ({ id, median: 2.2, samples: 10 })) }]; }, r => { r.threat!.phases[0].followerSpeeds[0].median = 2; });
  fixture('future weapon offered', 'L1', 'G-16', 'weapons offered in the ordinary initial racks', r => { r.observation!.initial!.racks = { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] }; }, r => { r.observation!.initial!.racks!.RIGHT.push('weapon.rocket-launcher'); });
  fixture('damaged corgi', 'L1', 'G-19', 'corgi health and real infected attack targets', r => { r.observation!.corgi.minimumHealthFraction = 1; r.observation!.corgi.targeted = 0; r.observation!.corgi.hit = 0; }, r => { r.observation!.corgi.minimumHealthFraction = .9; });
  fixture('short run-out', 'L1', 'G-20', 'engaged run-out duration and invulnerability', r => { r.observation!.runOut = { tick: 100, until: 400, minimumInvulnerableUntil: 400 }; }, r => { r.observation!.runOut!.until = 390; });
  fixture('nonempty L1 start arsenal', 'L1', 'L1-01', 'mission deadline and initial weapons', r => { r.observation!.initial!.racks = { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] }; r.observation!.initial!.deadline = null; }, r => { r.observation!.initial!.racks!.LEFT.push('weapon.bat'); });
  fixture('L2 ambush below absolute count', 'L2', 'L2-06', 'maximum admitted ambush identity ledger before retry thinning', r => { r.observation!.l2Maximum.ambush = 24; }, r => { r.observation!.l2Maximum.ambush = 23; });
  fixture('L3 missing cohort member', 'L3', 'L3-02', 'wave 0 actual admissions', r => { r.threat!.waves.find(wave => wave.key === 'station-0')!.spawned = 15; }, r => { r.threat!.waves.find(wave => wave.key === 'station-0')!.spawned = 14; });
  fixture('L3 actual first attack exceeds40s despite rebased state', 'L3', 'L3-02', 'latest attack clock', r => { r.observation!.final!.mission.l3!.attackAt = 118 * 60; r.observation!.ledger.find(e => e.type === 'l3.attack')!.tick = 40 * 60; }, r => { r.observation!.ledger.find(e => e.type === 'l3.attack')!.tick++; });
  fixture('L4 convoy count', 'L4', 'L4-01', 'convoy vehicle identities', r => { r.observation!.initial!.mission.l4!.convoyIds = [1, 2, 3, 4, 5]; }, r => { r.observation!.initial!.mission.l4!.convoyIds.pop(); });
  fixture('L5 placed population floor', 'L5', 'L5-03', 'initial placed infected identities', r => { r.observation!.initial!.mission.l5!.infectedIds = Array.from({ length: 60 }, (_, i) => i); }, r => { r.observation!.initial!.mission.l5!.infectedIds.pop(); });
  fixture('L5 competent route encounter density boundary', 'L5', 'L5-05', 'competent route visible infected encounters per40m', r => { r.run!.completed = true; r.observation!.l5SearchRoute = { ticks: 1200, metres: 40, discontinuities: 0, encounters: [{ id: 2, tick: 600, atMetres: 20, distance: 10 }] }; }, r => { r.observation!.l5SearchRoute.metres = 40.01; });
  fixture('L6 missing first-breach admissions', 'L6', 'L6-03', 'actual first-wave spawn admissions (floor traversal still open)', r => { r.observation!.final!.mission.l6!.spawnLog = Array.from({ length: 6 }, (_, id) => ({ id, door: 0, x: 0, z: 0, tick: 2000, wave: 1, offscreen: true })); }, r => { r.observation!.final!.mission.l6!.spawnLog.pop(); });
  fixture('L7 incomplete regular admissions', 'L7', 'L7-04', 'actual resident and later regular admissions', r => { r.run!.completed = true; const residents = r.observation!.initial!.census.filter(e => e.infected && e.hp > 0 && e.archetype === 'infected.runner').length; r.observation!.births['infected.runner'] = 200 - residents; }, r => { r.observation!.births['infected.runner']!--; });
  fixture('L8 breach clock boundary', 'L8', 'L8-04', 'breach active-sim clock', r => { r.observation!.final!.l8!.startedAt = 0; r.observation!.final!.l8!.breachedAt = 3601; }, r => { r.observation!.final!.l8!.breachedAt = 3602; });
  fixture('L9 repeated damage amount', 'L9', 'L9-04', 'actual contact/attack durability transactions', r => { r.observation!.ledger = [{ type: 'vehicle.durability-hit', tick: 1, sourceId: 2, targetId: 3, source: 'contact', contactId: 1, attackId: null, before: 100, after: 90 }]; }, r => { const event = r.observation!.ledger[0]; if (event.type === 'vehicle.durability-hit') event.after = 80; });
  fixture('L10 ineligible charge increment', 'L10', 'L10-10', 'actual eligible charge ticks and increments', r => { r.observation!.charge = { eligibleTicks: 3600, incrementTicks: 3600, invalidIncrements: 0, outsideTicks: 0, deadTicks: 0, maximum: 3600, activeTicks: 3600 }; }, r => { r.observation!.charge.invalidIncrements = 1; });
  fixture('L4 line1 beat too early', 'L4', 'L4-09', 'line1 actual beat after first turn', r => { r.run!.deaths = 0; const events = r.observation!.ledger, turn = events.find(e => e.type === 'l4.firstTurn')!; events.find(e => e.type === 'l4.beat' && e.beat === 'line-1')!.tick = turn.tick + 50 * 60; }, r => { const events = r.observation!.ledger; events.find(e => e.type === 'l4.beat' && e.beat === 'line-1')!.tick = events.find(e => e.type === 'l4.firstTurn')!.tick + 49 * 60; });
  fixture('L7 launcher exceeds exit radius', 'L7', 'L7-01', 'native launcher horizontal distance from night-exit checkpoint', r => { const start = r.observation!.initial!, exit = start.checkpoints.find(c => c.id === 'night-exit')!, launcher = start.census.find(e => e.archetype === 'weapon.rocket-launcher')!; launcher.x = exit.position[0] + 5; launcher.z = exit.position[2]; }, r => { r.observation!.initial!.census.find(e => e.archetype === 'weapon.rocket-launcher')!.x += .01; });
  fixture('L10 regional population misses floor', 'L10', 'L10-03', 'industrial-area normal local concurrent peak bound', r => { r.run!.completed = true; r.observation!.regions['industrial-area'].normalPeak = 17; }, r => { r.observation!.regions['industrial-area'].normalPeak = 15; });
  fixture('L10 regional population exceeds cap even excluding Mega', 'L10', 'L10-03', 'industrial-area normal local concurrent peak bound', r => { r.run!.completed = true; r.observation!.regions['industrial-area'].normalPeak = 28; }, r => { r.observation!.regions['industrial-area'].normalPeak = 30; });
  const source = sourceRows().find(row => row.id === 'L1-01')!;
  const onlyOneClause = evaluate(receipts.get('L1')!, 'fixture').filter(check => check.id === 'L1-01').slice(0, 1);
  assert.equal(rowResult(source, [...onlyOneClause, ...onlyOneClause.map(check => ({ ...check, tier: 'high' }))]).currentStatus, 'NOT CHECKED', 'one passing clause cannot close a compound row');
  const reachSource = sourceRows().find(row => row.id === 'L1-08')!;
  const reach = ['low', 'high'].flatMap(tier => ['complete', 'stationary'].flatMap(policy => {
    const receipt = JSON.parse(readFileSync(`${reportRoot}/receipts/L1-${tier}-${policy}.json`, 'utf8')) as NativeReceipt;
    return evaluate(receipt, 'fixture').filter(check => check.id === 'L1-08');
  }));
  assert.equal(rowResult(reachSource, reach).currentStatus, 'PASS', 'both policies and qualities qualify all L1 escape clauses');
  assert.equal(rowResult(reachSource, reach.slice(1)).currentStatus, 'NOT CHECKED', 'missing competent contact evidence cannot qualify the escape row');
  const pressureSource = sourceRows().find(row => row.id === 'L3-11')!;
  const pressure = ['low', 'high'].flatMap(tier => {
    const native = JSON.parse(readFileSync(`${reportRoot}/receipts/L3-${tier}-complete.json`, 'utf8')) as NativeReceipt;
    const fixtures = JSON.parse(readFileSync(`${reportRoot}/receipts/L3-${tier}-fixtures.json`, 'utf8')) as { checks: ReturnType<typeof evaluate> };
    return [...evaluate(native, 'fixture'), ...fixtures.checks].filter(check => check.id === 'L3-11');
  });
  assert.equal(rowResult(pressureSource, pressure).currentStatus, 'PASS', 'both qualities qualify pressure, per-street medkits and mortal newbie low-health time');
  assert.equal(rowResult({ ...pressureSource, baseline: { ...pressureSource.baseline, status: 'FAIL' } }, pressure).status, 'FAIL', 'a prior FAIL cannot be cleared by fresh full-row qualification');
  assert.equal(rowResult(pressureSource, pressure.filter(check => check.tier !== 'high' || check.clause !== 'initial authored medkit entities by street')).currentStatus, 'NOT CHECKED', 'missing high-tier per-street census cannot qualify L3 pressure');
  for (const id of ['L5-05', 'L7-05']) {
    const source = sourceRows().find(row => row.id === id)!;
    const measured = ['low', 'high'].flatMap(tier => ['complete', 'stationary'].flatMap(policy => evaluate(JSON.parse(readFileSync(`${reportRoot}/receipts/${source.level}-${tier}-${policy}.json`, 'utf8')), 'fixture').filter(check => check.id === id)));
    assert.equal(rowResult(source, measured).currentStatus, 'PASS', `${id} full numeric contract`);
    assert.equal(rowResult(source, measured.filter(check => check.tier !== 'high' || check.clause !== 'minimum bounded-path reachable share within30m (path≤2.5×direct)')).currentStatus, 'NOT CHECKED', `${id} requires both tiers' reachability`);
    assert.equal(rowResult(source, measured.map((check, i) => i ? check : { ...check, status: 'FAIL' })).currentStatus, 'FAIL', `${id} retains any failing clause`);
    assert.equal(rowResult({ ...source, baseline: { ...source.baseline, status: 'FAIL' } }, measured).status, 'FAIL', `${id} retains historical findings`);
  }
  for (const tier of ['low', 'high'] as const) {
    const breach = JSON.parse(readFileSync(`${reportRoot}/receipts/L8-${tier}-complete.json`, 'utf8')) as NativeReceipt;
    const rateClause = (receipt: NativeReceipt) => evaluate(receipt, 'fixture').find(check => check.id === 'L8-06' && check.clause === 'real player/group windups per minute');
    const below = structuredClone(breach);
    const belowPhase = below.threat!.phases.find(phase => phase.key === 'phase/breached')!;
    belowPhase.attacksPerMinute = 3.99; belowPhase.groupAttacksPerMinute = 0;
    const observed = rateClause(below);
    assert(observed && observed.value === 3.99 && observed.status === 'FAIL', `L8 ${tier} competent breach rate below 4/min must fail`);
    const passing = structuredClone(breach);
    const phase = passing.threat!.phases.find(item => item.key === 'phase/breached')!;
    phase.attacksPerMinute = 4; phase.groupAttacksPerMinute = 0;
    assert.equal(rateClause(passing)?.status, 'PASS', `L8 ${tier} competent breach rate at 4/min must pass`);
    results.push({ name: `L8 ${tier} competent breach-phase attack-rate boundary`, id: 'L8-06', clause: 'real player/group windups per minute', detected: observed.status === 'FAIL' && rateClause(passing)?.status === 'PASS' });
  }
  const oldFail = sourceRows().find(row => row.id === 'L3-03')!;
  assert.equal(rowResult(oldFail, []).status, 'FAIL', 'an unobserved rerun cannot clear a prior FAIL');
  const arsenalSource = sourceRows().find(row => row.id === 'G-16')!;
  const arsenal = [...receipts.values()].flatMap(receipt => ['low', 'high'].flatMap(tier => evaluate({ ...receipt, tier: tier as 'low' | 'high' }, 'fixture').filter(check => check.id === 'G-16')));
  assert.equal(rowResult(arsenalSource, arsenal).currentStatus, 'PASS', 'all10 levels at both tiers qualify initial arsenal');
  assert.equal(rowResult(arsenalSource, arsenal.slice(1)).currentStatus, 'NOT CHECKED', '19/20 starts cannot qualify global arsenal');
  const consoleSource = sourceRows().find(row => row.id === 'G-25')!;
  const consoles = Array.from({ length: 10 }, (_, i) => ['low', 'high'].map(tier => ({ id: 'G-25', clause: 'physical WASD/mouse full-level browser console', level: `L${i + 1}`, tier, policy: 'real-input-webgl2', status: 'PASS' as const, value: { completed: true, skipped: [], consoleErrors: [] }, target: 'complete ordinary-input route; zero console/page errors; no objective skips', receipt: 'fixture' }))).flat();
  assert.equal(rowResult(consoleSource, consoles).currentStatus, 'PASS');
  assert.equal(rowResult(consoleSource, consoles.slice(1)).currentStatus, 'NOT CHECKED', '19/20 browser runs cannot qualify global console gate');
  const evaluationHash = createHash('sha256').update(readFileSync(new URL('./evaluate.ts', import.meta.url))).update(readFileSync(new URL('./report.ts', import.meta.url))).update(readFileSync(new URL('./reviews.ts', import.meta.url))).update(readFileSync(new URL('./proof.ts', import.meta.url))).digest('hex');
  atomicJson(`${reportRoot}/evaluator-proof.json`, { ...identity, evaluationHash, results, compoundCoverage: true, globalMatrixCoverage: true, historicalFailuresPreserved: true });
  console.log(`[qa:accept:proof] ${results.length} broken fixtures detected; compound coverage and retained FAIL checks passed`);
}
