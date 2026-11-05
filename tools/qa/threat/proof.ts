import { observeAttackStarts } from './attackStarts';
import { loadLevel } from '../../sim-runner/levels';
import { ThreatObserver } from './observer';
import assert from 'node:assert/strict';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import type { EntitySnapshot, GameEvent } from '../../../src/sim/world/types';
import { median, isWalkingSample, PathProbe, phaseFlags, followerCoverageFlags, followerWaitFlags, observeBlocked, SpawnIdentities, type BlockedWindow } from './observer';
import { WaveObserver, waveFlags } from './waves';
import { EventBus } from '../../../src/core/EventBus';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { AuditReceipt } from '../threat-audit';
import { runLevel } from '../../sim-runner/levels';
import { newCampaign, preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { renderReport } from './report';
import { focusedCriteria } from './criteria';
import type { LevelReceipt } from '../threat-audit';
import { l9Groups, l9Encounters } from '../../../src/data/l9';
import { crossing } from '../../../src/levels/L9/district';

/** Replay the same policies without instrumentation and compare complete native state, not only completion. */
export async function provePassiveFrom(path: string, out: string, reportPath?: string): Promise<void> {
  const audit = JSON.parse(await readFile(path, 'utf8')) as AuditReceipt;
  assert.equal(audit.seed, 1); assert.equal(audit.tier, 'low'); assert.equal(audit.policy, 'complete');
  if (process.env.QA_THREAT_MAIN_REVISION) {
    assert.equal(process.env.QA_THREAT_MAIN_REVISION, audit.mainRevision);
    assert.equal(process.env.QA_THREAT_SOURCE_MATCHES_MAIN, 'true');
  } else execFileSync('git', ['diff', '--quiet', audit.mainRevision, '--', 'src', 'public']);
  const rows: { level: string; observed: string | null; control: string | null; equal: boolean }[] = [];
  const start = performance.now();
  for (const receipt of audit.levels) {
    const level = receipt.level, campaign = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as ProgressionPreset);
    campaign.seed = 1; campaign.settings.quality = 'low';
    let control: string | null = null;
    await runLevel(level, 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: 'low', beforeDispose: world => { control = stateHash(world.getState()); } });
    const row = { level, observed: receipt.nativeStateHash, control, equal: !!control && control === receipt.nativeStateHash };
    rows.push(row); console.log(`[qa:threat:passive] ${level}: ${row.equal ? 'identical' : 'DIFFERS'} (${control})`);
  }
  await mkdir(out, { recursive: true });
  const proof = { mainRevision: audit.mainRevision, seed: 1, tier: 'low', seconds: (performance.now() - start) / 1000, rows };
  await writeFile(join(out, 'passivity.json'), JSON.stringify(proof, null, 2) + '\n');
  assert(rows.length > 0 && rows.every(row => row.equal), 'instrumentation must preserve every native state hash');
  audit.passivity = { seconds: proof.seconds, levels: rows.length, matches: true };
  await writeFile(path, JSON.stringify(audit, null, 2) + '\n');
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, renderReport(audit, true));
    await writeFile(join(dirname(reportPath), 'baseline.json'), JSON.stringify(audit, null, 2) + '\n');
    await writeFile(join(dirname(reportPath), 'passivity.json'), JSON.stringify(proof, null, 2) + '\n');
  }
}

/** Red fixtures exercise the same evaluators as the gate, without growing the registered unit suite. */
export async function proveThreatAudit(): Promise<void> {
  {
    const events = new EventBus<GameEvent>(), starts: number[] = [];
    observeAttackStarts({ events } as unknown as SimWorld, (_source, target) => starts.push(target));
    events.emit({ type: 'telegraph', tick: 0, sourceId: 2, attackId: 1, special: 'lunge', duration: .35, target: { id: 1, x: 0, z: 0 } });
    // An interrupted windup counts, and its later resolution never counts twice.
    events.emit({ type: 'infected.attack', tick: 21, sourceId: 2, targetId: 1, attackId: 1, special: 'lunge', amount: 0 });
    events.emit({ type: 'telegraph', tick: 22, sourceId: 2, attackId: 2, special: 'alpha.roar', duration: .6, target: { id: 1, x: 0, z: 0 } });
    events.emit({ type: 'civilian.grabbed', tick: 30, sourceId: 3, targetId: 4, variant: '', rescueUntil: 90 });
    assert.deepEqual(starts, [1, 4], 'count real windups/grabs, excluding support roars and duplicate resolutions');
  }
  {
    const world = await loadLevel('L7', 1, undefined, 0, { quality: 'low' });
    try {
      // A blocked courier retains an old movement request. Only real position
      // changes can qualify escort walking or suppress stationary-wait time.
      world.update = () => { world.tick++; };
      const player = world.entities.get(1)!, follower = world.entities.get(world.l7Encounters!.state.roster[0].id)!;
      player.survivor!.velocity.x = 4.5;
      follower.transform.x = player.transform.x - 12;
      follower.civilian!.state = 'calm';
      follower.motion = { velocity: { x: 4.4, z: 0 }, speed: 4.4, moving: true, distance: 0 };
      const observer = new ThreatObserver(world, 'L7');
      for (let i = 0; i < 60; i++) world.update();
      const first = observer.finish();
      assert(first.phases.every(p => p.followerSpeeds.length === 0), 'stale requested velocity is not walking');
      assert.equal(first.followerWait.stationaryFarTicks, 60, 'physically stationary waiting is measured');
      world.storyLock = { scripted: null, skip: false };
      for (let i = 0; i < 60; i++) world.update();
      assert.equal(observer.finish().followerWait.escortTicks, first.followerWait.escortTicks, 'cinematics are outside the escort clock');
    } finally { world.dispose(); }
  }
  const good = { threat: true, attacks: 1, maxBlockedSeconds: 20, followerSpeeds: [{ id: 2, median: 2.2, samples: 10 }], followerMedian: 2.2 };
  assert.deepEqual(phaseFlags(good), []);
  assert.equal(isWalkingSample(1.5, 0, false, false), false, 'parked formation shuffling is not group walking');
  assert.equal(isWalkingSample(0, 4, true, false), true, 'a stalled follower must retain zero samples while the courier moves');
  assert.equal(isWalkingSample(0, 4, true, true), false, 'a bite hold is not a walking sample');
  const hold = { holdComplete: true, arrivalEdges: [0, 2, 4], threeDirectionsAtLeast60Degrees: true, maxGroupAtOneSourcePerTick: 5,
    firstBreachLevelSeconds: 45, firstBreachAfterTurnSeconds: 15, aliveAtFirstBreach: 74,
    minPlazaAliveAfter45Seconds: 40, samplesAfter45Seconds: 6000, lineBreakAfterTurnSeconds: 180 };
  const census = (highHold: object) => focusedCriteria([{ level: 'L4', highHold } as LevelReceipt]).filter(r => r.id.startsWith('L4-05') || r.id.startsWith('L4-06'));
  assert(census(hold).every(r => r.verdict === 'PASS'));
  assert(census({ ...hold, maxGroupAtOneSourcePerTick: 6 }).some(r => r.verdict === 'FAIL'));
  assert(census({ ...hold, minPlazaAliveAfter45Seconds: 39 }).some(r => r.verdict === 'FAIL'));
  assert(census({ ...hold, holdComplete: false }).some(r => r.verdict === 'FAIL'));
  for (const firstBreachLevelSeconds of [29.99, 60.01]) assert(census({ ...hold, firstBreachLevelSeconds }).some(r => r.verdict === 'FAIL'));
  for (const firstBreachLevelSeconds of [30, 60]) assert(census({ ...hold, firstBreachLevelSeconds }).every(r => r.verdict === 'PASS'));
  assert(census({ ...hold, aliveAtFirstBreach: 59 }).some(r => r.verdict === 'FAIL'));
  const stationWaves = [15, 30, 50].map((n, i) => ({ key: `station-${i}`, expected: n, spawned: n, scheduledStreamSeconds: 17, spawnedWithinEighteenSeconds: n, visibleWithinTwoSeconds: Math.ceil(n / 4) }));
  const station = (waves: object[]) => focusedCriteria([{ level: 'L3', observation: { phases: [], waves: stationWaves }, passiveObservation: { phases: [], waves } } as unknown as LevelReceipt]).filter(r => r.id.startsWith('L3-02'));
  assert(station(stationWaves).every(r => r.verdict === 'PASS'));
  assert(station(stationWaves.map((w, i) => i === 2 ? { ...w, spawned: 49 } : w)).some(r => r.verdict === 'FAIL'));
  assert(station(stationWaves.map((w, i) => i === 2 ? { ...w, spawnedWithinEighteenSeconds: 49 } : w)).some(r => r.verdict === 'FAIL'));


  const window: BlockedWindow = { streakStart: null, maxBlockedSeconds: 0, blockedEvidence: null };
  const snapshot = { tick: 0, alive: 10, reachable: 7, playerX: 0, playerZ: 0, positions: [] };
  observeBlocked(window, snapshot); observeBlocked(window, { ...snapshot, tick: 1300 });
  assert.equal(window.streakStart, null, 'exactly 30% must not start the sustained timer');
  observeBlocked(window, { ...snapshot, tick: 1400, reachable: 6 });
  observeBlocked(window, { ...snapshot, tick: 2600, reachable: 6 });
  assert.equal(window.maxBlockedSeconds, 20);
  observeBlocked(window, { ...snapshot, tick: 2601, reachable: 6 });
  assert(window.maxBlockedSeconds > 20);
  observeBlocked(window, { ...snapshot, tick: 2602, reachable: 10 });
  observeBlocked(window, { ...snapshot, tick: 2700, reachable: 6 });
  assert.equal(window.streakStart, 2700, 'recovery must reset the continuous high-share window');
  assert(phaseFlags({ ...good, attacks: 0 }).includes('ZERO_ATTACKS'));
  assert(!phaseFlags({ ...good, attacks: 0, groupAttacks: 1 }).includes('ZERO_ATTACKS'));
  assert(!phaseFlags({ ...good, threat: false, attacks: 0 }).includes('ZERO_ATTACKS'));
  assert(phaseFlags({ ...good, maxBlockedSeconds: 20.01 }).some(flag => flag.startsWith('UNREACHABLE')));
  assert(phaseFlags({ ...good, followerSpeeds: [{ id: 2, median: 1.4, samples: 10 }] }).includes('SLOW_FOLLOWER:2'));
  assert.deepEqual(phaseFlags({ ...good, followerSpeeds: [{ id: 2, median: .95 * 2.2, samples: 10 }] }), []);
  assert(followerCoverageFlags('L5', []).some(flag => flag.includes('FOLLOWER_PACE_UNOBSERVED:31')));
  assert(followerCoverageFlags('L5', [{ key: 'phase/search', followerMedian: 2.2, followerSpeeds: [{ id: 31, median: 2.2, samples: 9 }] }]).some(flag => flag.includes('FOLLOWER_PACE_UNOBSERVED:31')));
  assert.deepEqual(followerCoverageFlags('L5', [{ key: 'phase/search', followerMedian: 2.2, followerSpeeds: [28, 31].map(id => ({ id, median: .95 * 2.2, samples: 10 })) }]), []);
  assert(followerCoverageFlags('L5', [{ key: 'phase/search', followerMedian: 2.2, followerSpeeds: [{ id: 31, median: .94 * 2.2, samples: 10 }] }]).some(flag => flag.includes('SLOW_FOLLOWER:31')));
  assert.deepEqual(followerWaitFlags({ escortTicks: 1000, stationaryFarTicks: 100 }), []);
  assert(followerWaitFlags({ escortTicks: 1000, stationaryFarTicks: 101 }).includes('FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT'));
  assert(followerWaitFlags(undefined).includes('FOLLOWER_WAIT_UNOBSERVED'));
  assert.deepEqual(waveFlags({ firstAttackSeconds: 20, observedSeconds: 30, spawned: 3 }), []);
  assert(waveFlags({ firstAttackSeconds: 20.01, observedSeconds: 30, spawned: 3 }).length);
  assert(waveFlags({ firstAttackSeconds: null, observedSeconds: 21, spawned: 3 }).includes('WAVE_NO_ATTACK_WITHIN_20_SECONDS'));
  assert(waveFlags({ firstAttackSeconds: null, observedSeconds: 5, spawned: 3 }).includes('WAVE_OBSERVATION_ENDED_BEFORE_ATTACK'));
  assert(waveFlags({ firstAttackSeconds: 0, observedSeconds: 30, spawned: 2 }).includes('WAVE_FEWER_THAN_THREE_COHORT_MEMBERS'));
  {
  const member = { ...entityForWave(), id: 2 }, player = { ...member, id: 1, transform: { ...member.transform, x: 1 } };
  const events = new EventBus<{ tick: number; type: string; sourceId?: number; targetId?: number }>();
  const waveWorld = {
    tick: 120, events, entities: { get: (id: number) => id === 1 ? player : member }, infected: { active: [member], director: { inFrame: () => true } },
    missions: { state: { phase: 'playing', l3: { phase: 'attack', waves: [{ wave: 0, at: 60, id: 2 }] } } },
  } as unknown as SimWorld;
  const waves = new WaveObserver(waveWorld, 'L3', e => String(e.id));
  waves.afterTick();
  assert.equal(waves.finish()[0].firstAttackSeconds, null, 'proximity alone is not an attack');
  events.emit({ type: 'telegraph', tick: 120, sourceId: 2, attackId: 1, special: 'lunge', duration: .35, target: { id: 1, x: 1, z: 0 } } as never);
  waves.afterTick();
  assert.equal(waves.finish()[0].firstAttackSeconds, 1, 'a real cohort attack starts the contact clock');
  }
  {
  const events = new EventBus<GameEvent>();
  const player = { id: 1, transform: { x: 0, y: .7, z: 0 } } as EntitySnapshot;
  const nearby = [2, 3, 4].map(id => ({ id, transform: { x: 1, y: .7, z: 0 }, health: { current: 100, max: 100 }, infected: {} }) as EntitySnapshot);
  const waveWorld = { tick: 0, events, entities: new Map([player, ...nearby].map(e => [e.id, e])), infected: { active: nearby, director: { inFrame: () => true } },
    missions: { state: { phase: 'playing', l6: { entries: [], spawnLog: nearby.map(e => ({ id: e.id, door: 0, tick: 0, wave: 1 })) } } } } as unknown as SimWorld;
  const observedWave = new WaveObserver(waveWorld, 'L6', e => String(e.id));
  events.emit({ type: 'l6.breach1', tick: 0 }); observedWave.afterTick();
  waveWorld.tick = 1261; observedWave.afterTick();
  assert.equal(observedWave.finish()[0].firstAttackSeconds, null, 'standing nearby without attacking must not satisfy a breach');
  assert(observedWave.finish()[0].flags.includes('WAVE_NO_ATTACK_WITHIN_20_SECONDS'));
  events.emit({ type: 'telegraph', tick: 1261, sourceId: 2, attackId: 1, special: 'lunge', duration: .35, target: { id: 1, x: 0, z: 0 } });
  observedWave.afterTick();
  assert.equal(observedWave.finish()[0].firstAttackSeconds, 1261 / 60);
  assert(observedWave.finish()[0].flags.includes('WAVE_FIRST_ATTACK_OVER_20_SECONDS'));
  }
  assert.equal(median([2.2, 1.4, 2.2]), 2.2);
  // L9-02 requires the multi-member risk groups to have a 20 m detour.
  // L9-03's separate roadside singletons share this container, but are not
  // the 2x6 / 3x6 / 6x8 groups governed by that clearance criterion.
  const riskGroups = l9Groups.filter(group => group.runners + group.alphas > 1);
  assert.equal(riskGroups.length, crossing.routes.reduce((count, route) => count + route.risks.length, 0), 'every authored risk group remains covered');
  for (const group of riskGroups) {
    const detour = crossing.routes.find(route => route.id === group.route)!.detour;
    for (let i = 1; i < detour.length; i++) {
      const a = detour[i - 1], b = detour[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((group.at[0] - a[0]) * dx + (group.at[1] - a[1]) * dz) / (dx * dx + dz * dz)));
      assert(Math.hypot(group.at[0] - a[0] - t * dx, group.at[1] - a[1] - t * dz) >= l9Encounters.avoidM, `${group.id}: preserve the authored safe detour`);
    }
  }
  const nav = new NavGrid({ width: 20, depth: 20 }, []), probe = new PathProbe();
  const entity = { id: 2, kind: 'infected', archetype: 'infected.runner', transform: { x: -5, y: .7, z: 0, yaw: 0 }, health: { current: 100, max: 100 }, faction: 'infected' } as EntitySnapshot;
  let births = 0;
  const identities = new SpawnIdentities(() => { births++; });
  const first = identities.spawn(entity), corpse = { ...entity, corpse: true };
  assert.equal(identities.identity(corpse), first, 'settled corpse clone is not a second spawn');
  assert.equal(births, 1);
  const second = identities.spawn(entity);
  assert.notEqual(second, first, 'same numeric pool ID must count as a new spawn');
  assert.equal(identities.identity(corpse), first, 'later reuse must not relabel an already observed corpse');
  assert.equal(births, 2);
  const goal = { x: 5, z: 0 };
  assert(probe.query(nav, entity, goal));
  nav.setBlocker(43, { x: 0, z: 0, y: 1, halfX: .5, halfY: 1, halfZ: 6 }, true);
  const close = { ...entity, transform: { ...entity.transform, x: -2 } }, closeGoal = { x: 2, z: 0 };
  assert(probe.query(nav, close, closeGoal), 'a long detour still has an unbounded path');
  assert.equal(probe.query(nav, close, closeGoal, 2.5), false, 'a detour longer than2.5×direct must fail bounded reachability');
  nav.setBlocker(43, { x: 0, z: 0, y: 1, halfX: .5, halfY: 1, halfZ: 6 }, false);
  assert(probe.query(nav, close, closeGoal, 2.5), 'removing the detour restores the bounded path');
  nav.setBlocker(43, { x: 0, z: 0, y: 1, halfX: .5, halfY: 1, halfZ: 2.5 }, true);
  const staircase: number[] = [];
  assert(nav.path(nav.nearestCell(-2, 0, .35), nav.nearestCell(2, 0), staircase, Infinity));
  let staircaseLength = 0, sx = -2, sz = 0;
  for (const cell of staircase) { staircaseLength += Math.hypot(nav.x(cell) - sx, nav.z(cell) - sz); sx = nav.x(cell); sz = nav.z(cell); }
  staircaseLength += Math.hypot(2 - sx, sz);
  assert(staircaseLength > 10, 'the former staircase metric rejects this physically valid walk');
  assert(probe.query(nav, close, closeGoal, 2.5), 'body-clear corner cutting can satisfy2.5×direct despite a longer cell-centre staircase');
  nav.setBlocker(43, { x: 0, z: 0, y: 1, halfX: .5, halfY: 1, halfZ: 2.5 }, false);
  nav.setBlocker(42, { x: 0, z: 0, y: 1, halfX: 1, halfY: 1, halfZ: 10 }, true);
  const from = nav.nearestCell(-5, 0), to = nav.nearestCell(5, 0);
  nav.path(from, to, [], 1);
  const expansions = nav.expansions, pending = nav.pending(from, to), blocked = nav.blocked.slice();
  assert.equal(probe.query(nav, entity, goal), false, 'broken doorway fixture must have no native route');
  assert.equal(nav.expansions, expansions); assert.equal(nav.pending(from, to), pending); assert.deepEqual(nav.blocked, blocked);
  nav.setBlocker(42, { x: 0, z: 0, y: 1, halfX: 1, halfY: 1, halfZ: 10 }, false);
  assert(probe.query(nav, entity, goal), 'live blocker revision must invalidate the independent snapshot');
  console.log('[qa:threat:proof] red fixtures proved: zero attacks, sustained disconnection, slow follower, proximity without attacks, late/missing arrival, incomplete observation; native route snapshot is passive and follows blocker changes');
}

function entityForWave(): EntitySnapshot {
  return { id: 2, transform: { x: 0, y: .7, z: 0, yaw: 0 }, health: { current: 60, max: 60 }, infected: {} } as EntitySnapshot;
}
