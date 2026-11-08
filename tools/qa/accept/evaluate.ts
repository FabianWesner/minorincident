import type { L8PathProof } from './fix55-l8-paths';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { NativeReceipt } from './probe';
import { l3SeedVerdict } from '../threat/l3SeedVote';
import { l3WaveCount } from '../../../src/data/l3';
import type { PhaseReceipt } from '../threat/observer';
import { median } from '../threat/observer';
import { followerPaceVerdict } from '../threat/followerPace';

export type Verdict = 'PASS' | 'FAIL' | 'NOT CHECKED';
export interface Clause {
  id: string; clause: string; tier: string; policy: string; status: Verdict;
  level?: string;
  value: unknown; target: string; receipt: string;
}
const attackRows: Record<string, { id: string; phase: string; first?: number; rate: number; reach?: number; group?: boolean }> = {
  L1: { id: 'L1-08', phase: 'phase/spread', first: 20, rate: 3, reach: 90 },
  // The combat clock begins when the doors open, not when the crew arrives.
  L2: { id: 'L2-07', phase: 'phase/collapse', first: 15, rate: 4, reach: 90 },
  L3: { id: 'L3-03', phase: 'step/defend', first: 10, rate: 4, reach: 90 },
  L4: { id: 'L4-07', phase: 'step/hold', first: 10, rate: 6, reach: 90 },
  L5: { id: 'L5-05', phase: 'step/look', first: 20, rate: 3, reach: 90, group: true },
  L6: { id: 'L6-05', phase: 'step/stop', first: 15, rate: 4, reach: 95 },
  L7: { id: 'L7-05', phase: 'step/corridor', first: 10, rate: 6, reach: 90, group: true },
  L8: { id: 'L8-06', phase: 'phase/breached', first: 20, rate: 4, reach: 90, group: true },
  L10: { id: 'L10-11', phase: 'step/hold', rate: 8, reach: 90 },
};

/** Each clause states its limited scope. Passing a subset never closes a compound source row. */
export function evaluate(receipt: NativeReceipt, path: string): Clause[] {
  const checks: Clause[] = [];
  const add = (id: string, clause: string, value: unknown, target: string, pass: boolean | undefined, evidencePath = path) => {
    checks.push({ id, clause, level: receipt.level, tier: receipt.tier, policy: receipt.policy, status: pass === undefined ? 'NOT CHECKED' : pass ? 'PASS' : 'FAIL', value, target, receipt: evidencePath });
  };
  const number = (id: string, clause: string, value: number | null | undefined, min: number, max: number) => add(id, clause, value ?? null, `${min} ≤ value ≤ ${max}`, value == null ? undefined : value >= min && value <= max);
  const observation = receipt.observation, threat = receipt.threat;
  if (!observation?.initial || !observation.final || receipt.error) {
    add('G-25', 'native probe execution (not browser console coverage)', receipt.error ?? receipt.run?.outcome ?? 'missing observation', 'complete probe receipt', undefined);
    return checks;
  }
  const { initial, final } = observation, state = final.mission, low = receipt.tier === 'low', competent = receipt.policy === 'complete';
  const phase = (key: string): PhaseReceipt | undefined => threat?.phases.find(p => p.key === key);

  // Globals are evaluated first for every selected level. Rendering/timing clauses remain explicitly open.
  number('G-05', 'native concurrent infected peak (no frame/performance measurement)', observation.peakAlive, 0, low ? 100 : 200);
  const moving = observation.markers.filter(marker => marker.maxDisplacement > .01);
  // l6-next is reused for discrete gate destinations; cure-mega changes from console to boss.
  // A maximum span alone cannot distinguish these handoffs from forbidden steering.
  const unknownHandoffs = moving.some(marker => ['l6-next', 'cure-mega'].includes(marker.id));
  add('G-08', 'fixed anchor positions during the observed native route', { anchors: observation.markers, changes: observation.markerChanges }, 'fixed action points; reused gate/boss anchors require a position trajectory', observation.markers.length ? moving.some(marker => !['l6-next', 'cure-mega'].includes(marker.id)) ? false : unknownHandoffs ? undefined : true : undefined);
  const distances = observation.pickups.filter(pickup => pickup.distance !== null && (pickup.collector === 1 || pickup.collector === null && pickup.distance <= (pickup.shelf ? 2.2 : 1.5)));
  add('G-10', 'observed approach collection distances; E-free causality needs an input fixture', distances, 'ground ≤1.5 m; shelf ≤2.2 m', distances.length ? distances.every(pickup => pickup.distance !== null && pickup.distance <= (pickup.shelf ? 2.2 : 1.5) + 1e-6) : undefined);
  const duplicateEntities = observation.duplicatePickups.filter(id => id > 0); // id0 is a mission-grant sentinel, not a respawned pickup.
  add('G-11', 'duplicate pickup transactions since the last restore', duplicateEntities, 'zero positive entity-ID duplicates on the same timeline', duplicateEntities.length === 0);
  if (competent) {
    const paces = (threat?.phases ?? []).filter(row => row.key.startsWith('step/')).flatMap(row => {
      const humans = row.followerSpeeds.filter(follower => follower.samples >= 10 && !observation.corgi.ids.includes(follower.id));
      const groupMedian = median(humans.map(follower => follower.median));
      return humans.map(follower => ({ phase: row.key, id: follower.id, samples: follower.samples, median: follower.median, groupMedian, ratio: groupMedian ? follower.median / groupMedian : null }));
    });
    const multiSeed = receipt.level === 'L5' || receipt.level === 'L7';
    const paceVerdict = multiSeed ? followerPaceVerdict(receipt.followerPaceSeeds ?? [], { stepsOnly: true, humansOnly: true }) : null;
    const paceValues = multiSeed ? paceVerdict : paces;
    const pacePass = multiSeed ? paceVerdict?.pass : paces.length ? paces.every(pace => pace.ratio !== null && pace.ratio >= .95) : undefined;
    add('G-13', 'each observed follower median versus its phase group median', paceValues, 'every ratio ≥0.95; ≥10 walking samples/follower', pacePass);
    const escortRow = { L5: 'L5-08', L6: 'L6-08', L7: 'L7-09' }[receipt.level as 'L5' | 'L6' | 'L7'];
    if (escortRow) add(escortRow, 'observed human follower pace versus phase group median', paceValues, 'every ratio≥0.95; bar pixels and absolute formation remain open', pacePass);
    const wait = threat?.followerWait;
    add('G-13', 'stationary far-follower time upper bound', wait ?? null, 'actual waiting ≤10%; a bound above 10% is inconclusive', wait?.upperBoundPercent != null && wait.upperBoundPercent <= 10 ? true : undefined);
  }
  const allowed = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher'];
  const offered = [...new Set([...(initial.racks?.LEFT ?? []), ...(initial.racks?.RIGHT ?? [])])].filter(id => id.startsWith('weapon.') && !['weapon.fists', 'weapon.kick'].includes(id));
  const n = Number(receipt.level.slice(1)), maximum = n === 10 ? ['weapon.fire-axe'] : allowed.slice(0, n <= 5 ? n : n < 7 ? 5 : 6);
  add('G-16', 'weapons offered in the ordinary initial racks', offered, n === 10 ? 'exactly [axe]' : `subset of ${JSON.stringify(n === 1 ? [] : maximum)}`, n === 10 ? offered.length === 1 && offered[0] === 'weapon.fire-axe' : offered.every(id => (n === 1 ? [] : maximum).includes(id)));
  add('G-19', 'corgi health and real infected attack targets', observation.corgi, 'health fraction=1; zero target windups and damaging hits', observation.corgi.samples ? observation.corgi.minimumHealthFraction === 1 && observation.corgi.targeted === 0 && observation.corgi.hit === 0 : undefined);
  const runOut = observation.runOut;
  add('G-20', 'engaged run-out duration and invulnerability', runOut, '300 ticks ±1; invulnerability through deadline', runOut ? Math.abs(runOut.until - runOut.tick - 300) <= 1 && runOut.minimumInvulnerableUntil >= runOut.until : undefined);
  // Measure announced cohorts on both the ordinary moving route and the
  // stationary control. The moving-route receipts exposed late/no attacks on
  // waves which the stationary-only G-22 check could not see.
  for (const wave of threat?.waves ?? []) {
    if (!/^(?:market-ambush|station-|breach-|l6\.breach|entry-|tunnel-breach|dispersal-assault|war-0@)/.test(wave.key)) continue;
    if (!wave.flags.length && wave.firstAttackSeconds === null) continue;
    add('G-22', `announcement cohort ${wave.key}`, { seconds: wave.observedSeconds, spawned: wave.spawned, firstAttackSeconds: wave.firstAttackSeconds, flags: wave.flags }, '≥3 admitted cohort members; real player windup within20 s', wave.firstAttackSeconds !== null ? wave.spawned >= 3 && wave.firstAttackSeconds <= 20 : wave.observedSeconds >= 20 ? false : undefined);
  }

  const attack = attackRows[receipt.level], combat = attack && phase(attack.phase);
  if (attack && combat) {
    // L2's native doors objective ends before the ambush has a full contact window.
    // Do not mistake the pre-opening objective duration for a passive attack clock.
    add(attack.id, 'combat hard rule on actual player windups', { seconds: combat.seconds, playerWindups: combat.attacks, groupWindups: combat.groupAttacks, attacksPerMinute: combat.attacksPerMinute }, 'nonzero player windups in each combat policy', combat.seconds > 1 ? combat.attacks > 0 : undefined);
    if (!competent && attack.first !== undefined) add(attack.id, 'stationary first real player attack (phase clock)', { seconds: combat.firstAttackSeconds, windowSeconds: combat.seconds }, `≤${attack.first} s`, combat.firstAttackSeconds !== null ? combat.firstAttackSeconds <= attack.first : combat.seconds >= attack.first ? false : undefined);
    // A naturally completed defense is a whole phase even when the first-of
    // fallback rule ends it before twenty seconds. Truncated samples still wait.
    const finishedDefense = receipt.level === 'L3' && combat.seconds > 0 && observation.ledger.some(event =>
      event.type === 'l3.fallback' && Math.abs(event.tick / 60 - combat.startSeconds - combat.seconds) <= 1 / 60 + 1e-6);
    const completedAssignedPhase = competent && ['L1', 'L2', 'L3'].includes(receipt.level) && receipt.run?.completed && combat.seconds > 0;
    // L8's competent route still has an explicit breach-phase attacks/minute
    // target. The native phase ledger supplies that window after the 60 s calm.
    if (!competent || ['L1', 'L2', 'L3', 'L5', 'L6', 'L7', 'L8'].includes(receipt.level)) number(attack.id, 'real player/group windups per minute', (combat.seconds >= 20 || finishedDefense || completedAssignedPhase) ? combat.attacksPerMinute + (attack.group ? combat.groupAttacksPerMinute : 0) : null, attack.rate, Infinity);
    if (attack.reach !== undefined) number(attack.id, 'minimum bounded-path reachable share within30m (path≤2.5×direct)', combat.boundedPaths?.samples ? combat.boundedPaths.minimumPercent : null, attack.reach, 100);
    if (receipt.level === 'L4') add(attack.id, 'post-opening legal ground or barrier path for every sampled infected', combat.legalPaths ?? null,
      'every sampled infected has a proven legal route after first physical breach/gate opening; any unproven route keeps the no-permanent-trap clause open',
      combat.legalPaths?.samples && combat.legalPaths.minimumPercent === 100 ? true : undefined);
  }
  const s1 = state.l1, s2 = state.l2, s3 = state.l3, s4 = state.l4, s5 = state.l5, s6 = state.l6;
  switch (receipt.level) {
    case 'L1': {
      if (competent) {
        add('L1-01', 'native mission graph completion', receipt.run?.outcome, 'complete', receipt.run?.completed);
        add('L1-01', 'mission deadline and initial weapons', { deadline: initial.deadline, weapons: offered }, 'no global fail timer; no starting weapons', initial.deadline === null && offered.length === 0);
      }
      number('L1-02', 'initial civilian entity census', initial.census.filter(e => e.civilian && !e.infected && !e.animal).length, 50, 60);
      add('L1-02', 'morning infected/combat census', observation.calm, 'zero infected and combat events during morning', observation.calm.ticks ? observation.calm.maxAlive === 0 && observation.calm.combatEvents === 0 : undefined);
      const calm = observation.phaseStarts.find(p => p.phase === 'calm'), accident = observation.phaseStarts.find(p => p.phase === 'accident');
      number('L1-05', 'objective-free calm controller interval', calm && accident ? (accident.tick - calm.tick) / 60 : null, 4, 6);
      number('L1-06', 'native Annex exit identities', s1?.exitIds.length, 5, 5);
      add('L1-06', 'technician is first exit identity', s1 ? { technician: s1.techId, exits: s1.exitIds, headings: s1.exitHeadingsDeg } : null, 'exitIds[0] equals technician id', s1?.exitIds.length ? s1.exitIds[0] === s1.techId : undefined);
      number('L1-14', 'admitted garage refuge residents', s1?.house?.ids.length, 6, Infinity);
      break;
    }
    case 'L2': {
      const tickOf = (type: string) => observation.ledger.find(event => event.type === type)?.tick;
      const alarm = tickOf('l2.alarm'), departed = tickOf('l2.truckDeparted'), arrived = tickOf('l2.truckArrived'), exit = tickOf('l2.crewExit'), atDoors = tickOf('l2.firefightersAtDoors'), opened = tickOf('l2.doorsOpen');
      if (!competent) {
        const contact = observation.l2Contact;
        add('L2-07', 'stationary first player attack from actual doors-open clock', contact, 'first attack ≤15 s', contact.firstAttackSeconds !== null ? contact.firstAttackSeconds <= 15 : contact.ticks >= 900 ? false : undefined);
        number('L2-07', 'stationary player windups/min after doors open', contact.ticks >= 20 * 60 ? contact.playerAttacks * 3600 / contact.ticks : null, 4, Infinity);
      }
      number('L2-01', 'first alarm level clock (before any checkpoint rebasing)', alarm ? alarm / 60 : null, 20, 30);
      number('L2-01', 'bench civilian identity count', initial.mission.l2?.benchIds.length, 4, 4);
      add('L2-01', 'pre-alarm combat/infected census', observation.calm, 'zero infected; zero combat events', observation.calm.ticks ? observation.calm.maxAlive === 0 && observation.calm.combatEvents === 0 : undefined);
      number('L2-03', 'actual departure-to-arrival route time', arrived && departed ? (arrived - departed) / 60 : null, 15, 25);
      number('L2-03', 'crew-exit start after arrival (not all-seven exit completion)', exit && arrived ? (exit - arrived) / 60 : null, 0, 4);
      add('L2-04', 'arrival/exit/doors event order', [arrived, exit, atDoors, opened], 'arrival ≤crewExit ≤atDoors ≤doorsOpen; all observed', opened && arrived && exit && atDoors ? arrived <= exit && exit <= atDoors && atDoors <= opened : undefined);
      number('L2-04', 'door forcing duration', opened && atDoors ? (opened - atDoors) / 60 : null, 4, 4);
      add('L2-04', 'nearest living infected before doors open', observation.l2BeforeDoors, 'none within40 m', observation.l2BeforeDoors.samples ? observation.l2BeforeDoors.nearest === null || observation.l2BeforeDoors.nearest >= 40 : undefined);
      number('L2-05', 'prepared trapped civilian identities', initial.mission.l2?.trappedIds.length, low ? 20 : 30, low ? 20 : 30);
      number('L2-05', 'first release after doors open', observation.releaseFirstTick && opened ? (observation.releaseFirstTick - opened) / 60 : null, 0, 1);
      number('L2-06', 'maximum admitted ambush identity ledger before retry thinning', observation.l2Maximum.ambush, 24, 24);
      if (competent) {
        number('L2-12', 'competent bridge player attack rate', phase('step/bridge')?.attacksPerMinute, 2, 20);
        const route = observation.l2Route;
        const density = route && route.metres > 0 ? route.encounterIds.length * 30 / route.metres : null;
        add('L2-12', 'visible infected encountered per30m of actual bridge route', { ...route, infectedPer30m: density },
          '≥1 distinct living admitted infected within15m with clear sight per30m walked; completed route, no deaths or discontinuities',
          route && density !== null && receipt.run?.completed && receipt.run.deaths === 0 && route.discontinuities === 0 ? density >= 1 : undefined);
      }
      if (competent && receipt.run?.completed) number('L2-14', 'maximum admitted Elm cluster identities before retry thinning', observation.l2Maximum.cluster, 12, 16);
      number('L2-15', 'prepared checkpoint officers', s2?.officerIds.length, 4, Infinity);
      number('L2-15', 'prepared checkpoint civilians', s2?.lineIds.length, 8, Infinity);
      number('L2-15', 'gate delay after crossing', s2?.crossedAt && s2.gateClosedAt ? (s2.gateClosedAt - s2.crossedAt) / 60 : null, 0, 1.5);
      break;
    }
    case 'L3': {
      const destination = observation.markers.find(marker => marker.id === 'l3-zone');
      add('L3-12', 'native fixed army checkpoint marker coordinates', destination ?? null, 'l3-zone remains fixed; HUD distance and route readability remain open', destination ? destination.maxDisplacement <= 1e-6 : undefined);
      // Checkpoint restore rebases stored mission ticks. The first event ledger
      // retains the original level clock, including mortal high-tier retries.
      const handgun = observation.ledger.find(event => event.type === 'l3.handgun'), firstAttack = observation.ledger.find(event => event.type === 'l3.attack');
      number('L3-01', 'actual handgun pickup clock', handgun ? handgun.tick / 60 : null, 0, 40);
      number('L3-02', 'attack delay after handgun pickup', firstAttack && handgun ? (firstAttack.tick - handgun.tick) / 60 : null, 5, 5);
      number('L3-02', 'latest attack clock', firstAttack ? firstAttack.tick / 60 : null, 0, 40);
      const waves = threat?.waves.filter(wave => wave.key.startsWith('station-')) ?? [];
      for (let i = 0; i < 3; i++) { const wave = waves.find(w => w.key === `station-${i}`); number('L3-02', `wave ${i} actual admissions`, wave?.spawned, l3WaveCount(i, low), l3WaveCount(i, low)); }
      const opening = waves.find(wave => wave.key === 'station-0');
      add('L3-02', 'opening wave visible within two seconds', opening ? { visible: opening.visibleWithinTwoSeconds, expected: opening.expected } : null,
        'at least 25% of the opening wave in frame within two seconds', opening && opening.expected !== null ? opening.visibleWithinTwoSeconds >= Math.ceil(opening.expected / 4) : undefined);
      if (competent) for (let i = 0; i < 3; i++) {
        const admitted = s3?.waves.filter(wave => wave.wave === i && wave.id > 0) ?? [];
        const total = l3WaveCount(i, low), police = admitted.filter(wave => wave.dir === 'station').length;
        add('L3-02', `wave ${i} admitted station-door share`, { admitted: admitted.length, police, percent: admitted.length ? police * 100 / admitted.length : null },
          `exactly 20% of the full ${total}-infected wave emerges from the station door`,
          receipt.run?.completed && admitted.length === total ? police === total * .2 : undefined);
      }
      if (!competent) {
        number('L3-04', 'fallback within sixty seconds without player fire', s3?.fallbackAt && s3.attackAt ? (s3.fallbackAt - s3.attackAt) / 60 : null, 0, 60);
        number('L3-04', 'same-id turned officer ledger', s3?.turnedOfficers.length, 1, Infinity);
      }
      const squad = threat?.l3Squad;
      if (competent) {
        number('L3-06', 'initial squad count', squad?.initial, 3, 4); const army = receipt.l3Army;
        add('L3-06', 'squad remaining at army arrival (seeds 1–3)', army ?? { seed1: squad?.army ?? null }, '≥2 at the army line (PO 2026-11-07): ≥2 valid seeds, ≥2 of them ≥2', army?.pass);
        add('L3-06', 'logged squad-loss causes', squad?.losses ?? null, 'each loss bite, kill, or separation', squad ? squad.losses.every(loss => ['bite', 'kill', 'separated'].includes(loss.cause)) : undefined);
        // The historical clause name counts infected windups against the courier.
        const attackVote = l3SeedVerdict((receipt.l3Army?.seeds ?? []).map(seed => ({ seed: seed.seed, valid: seed.valid && seed.attacksPerMinute != null, pass: seed.attacksPerMinute == null ? null : seed.attacksPerMinute >= 3 && seed.attacksPerMinute <= 25 })));
        add('L3-11', 'competent player attack rate on checkpoint route', { seeds: receipt.l3Army?.seeds.map(seed => ({ seed: seed.seed, attacksPerMinute: seed.attacksPerMinute ?? null })), vote: `${attackVote.within}/${attackVote.measured}` }, '3–25 infected attacks against player/min; 2 of 3 valid seeds pass', attackVote.pass);
      }
      number('L3-11', 'all-street medkit census (per-street split still open)', initial.mission.l3?.medkitIds.length, 7, Infinity);
      number('L3-14', 'actual army soldier identities', s3?.soldierIds.length, 8, Infinity);
      break;
    }
    case 'L4': {
      const turn = observation.ledger.find(event => event.type === 'l4.firstTurn');
      const beats = ['line-1', 'nests', 'armor'].map(beat => observation.ledger.find(event => event.type === 'l4.beat' && event.beat === beat));
      // L4 retries preserve the battle clock. Admit that timeline only when its
      // source event, final clocks and unique line breaks agree.
      const oneTimeline = !!turn && observation.ledger.filter(event => event.type === 'l4.firstTurn').length === 1 &&
        [s4?.gunAt, s4?.turnAt, s4?.warAt].every(tick => tick === turn.tick) &&
        ['line-1', 'nests', 'armor'].every((id, i) => observation.ledger.filter(event => event.type === 'l4.beat' && event.beat === id).length === 1 &&
          s4?.director.lines.find(line => line.id === id)?.brokeAt === beats[i]?.tick);
      if (competent && oneTimeline) {
        for (let i = 0; i < beats.length; i++) number('L4-09', `${['line1', 'nests', 'armor'][i]} actual beat after first turn`, turn && beats[i] ? (beats[i]!.tick - turn.tick) / 60 : null, [50, 110, 170][i], [62, 124, 182][i]);
        number('L4-09', 'fallback after third line break', s4?.director.fallBackAt && beats[2] ? (s4.director.fallBackAt - beats[2].tick) / 60 : null, 8, 8);
      }
      if (competent && receipt.run?.deaths === 0) {
        const descended = observation.ledger.find(event => event.type === 'l4.descended'), barred = observation.ledger.find(event => event.type === 'l4.doorBarred');
        add('L4-16', 'entry-to-bar interval including bot approach/input latency', descended && barred ? (barred.tick - descended.tick) / 60 : null, 'bar interaction1s; entry interval cannot isolate interaction duration', undefined);
        number('L4-16', 'native post-bar battle observation interval (audibility remains open)', s4?.doneAt && s4.barredAt ? (s4.doneAt - s4.barredAt) / 60 : null, 6, Infinity);
      }
      number('L4-01', 'convoy vehicle identities', initial.mission.l4?.convoyIds.length, 5, 5);
      number('L4-01', 'convoy duration', s4?.arrivedAt ? (s4.arrivedAt - s4.rideAt) / 60 : null, 20, 35);
      add('L4-02', 'pre-pickup combat and living infected', observation.calm, 'zero infected; zero combat events', observation.calm.ticks ? observation.calm.maxAlive === 0 && observation.calm.combatEvents === 0 : undefined);
      number('L4-03', 'war starts on MG pickup tick', s4?.warAt && s4.gunAt ? s4.warAt - s4.gunAt : null, 0, 0);
      const scale = observation.l4Scale;
      number('L4-04', 'soldiers at turn', scale?.turn?.soldiers.length, low ? 9 : 18, low ? 11 : 22);
      number('L4-04', 'civilian census at turn excluding soldiers', scale?.turn?.civilians.length, low ? 30 : 60, low ? 35 : 70);
      number('L4-04', 'war-phase concurrent infected cap', observation.phasePeaks.war?.alive, 0, low ? 80 : 120);
      number('L4-04', 'war-phase concurrent character cap', observation.phasePeaks.war?.characters, 0, low ? 120 : 190);
      add('L4-04', 'every war tick observed from turn through line break', scale ? { ticks: scale.ticks, firstTick: scale.firstTick, lastTick: scale.lastTick, turnAt: s4?.turnAt, lineBreakAt: s4?.lineBreakAt } : null,
        'one contiguous observation per simulation tick from turn through the tick before collapse', scale?.turn && s4?.lineBreakAt ?
          scale.firstTick === s4.turnAt && scale.lastTick === s4.lineBreakAt - 1 && scale.ticks === s4.lineBreakAt - s4.turnAt ? true : undefined : undefined);
      number('L4-04', 'actual armed civilian share at turn', scale?.turn?.civilians.length ? scale.turn.armed.length / scale.turn.civilians.length : null, .4, 1);
      number('L4-04', 'war living infected plus reserved slots and pending turns', scale?.ticks ? scale.peakSlots?.total : null, 0, low ? 80 : 120);
      number('L4-04', 'war living character identity census', scale?.ticks ? scale.peakCharacters?.ids.length : null, 0, low ? 120 : 190);
      if (receipt.highHold) {
        const h = receipt.highHold;
        number('L4-05', 'distinct arrival street edges', h.arrivalEdges.length, 3, Infinity);
        add('L4-05', 'separated directions and group limit', h, '≥3 directions ≥60° apart; ≤5 at one source/tick', h.threeDirectionsAtLeast60Degrees && h.maxGroupAtOneSourcePerTick <= 5);
        number('L4-06', 'first physical breach level clock', h.firstBreachLevelSeconds, 30, 60);
        number('L4-06', 'living infected at first breach', h.aliveAtFirstBreach, 60, Infinity);
        number('L4-06', 'sustained plaza living minimum after +45 s', h.holdComplete && h.samplesAfter45Seconds ? h.minPlazaAliveAfter45Seconds : null, 40, Infinity);
      }
      number('L4-08', 'actual Alpha identity count', s4?.alphaIds.length, low ? 6 : 8, low ? 6 : 8);
      number('L4-10', 'HMG firing sources', s4 ? Object.keys(s4.hmgLastAt).length : null, 2, Infinity);
      if (competent && receipt.run?.completed) {
        number('L4-14', 'live fire count at end of route', s4?.fires, 4, Infinity);
        number('L4-14', 'shattered window ledger at end of route', s4?.glass.length, 10, Infinity);
        add('L4-14', 'legacy scorch controller field (not maintained as renderer decal census)', s4?.scorch, 'actual scorch decals≥6; renderer census required', undefined);
      }
      break;
    }
    case 'L5': {
      number('L5-03', 'initial placed infected identities', initial.mission.l5?.infectedIds.length, low ? 60 : 90, Infinity);
      number('L5-04', 'live initial Alpha identities', initial.census.filter(e => e.infected && e.archetype === 'infected.alpha' && e.hp > 0).length, 2, Infinity);
      if (competent) {
        const route = observation.l5SearchRoute;
        number('L5-05', 'competent route visible infected encounters per40m', receipt.run?.completed && route?.ticks && route.metres > 0 && !route.discontinuities ? route.encounters.length * 40 / route.metres : null, 1, Infinity);
        const formation = observation.l5Formation ?? [];
        const measured = formation.filter(row => row.calmTicks > 0);
        add('L5-08', 'non-combat follower share within8m', formation, 'each living follower within8m for at least80percent of calm ticks',
          measured.some(row => row.within8Ticks / row.calmTicks < .8) ? false : receipt.run?.completed && measured.length === 5 ? true : undefined);
        add('L5-08', 'calm straight-walk follower distance tolerance', formation, 'at least95% of calm straight-walk ticks 2–5m behind; no out-of-band run longer than2s',
          receipt.run?.completed && measured.length === 5 && measured.every(row => row.straightTicks > 0 && row.inBandStraightTicks / row.straightTicks >= .95 && row.maxBadRun <= 120) ? true
            : measured.some(row => row.straightTicks > 0 && (row.inBandStraightTicks / row.straightTicks < .95 || row.maxBadRun > 120)) ? false : undefined);
      }
      if (competent) number('L5-09', 'native complete rescued result', state.result?.rescued, 4, 5);
      number('L5-12', 'station occupant identities', s5?.stationIds.length, 20, 30);
      if (s5?.gloom !== undefined) number('L5-14', 'sun intensity state multiplier at metro/end', s5.gloom, 0, .7);
      break;
    }
    case 'L6': {
      number('L6-01', 'initial shelter occupant identities', initial.mission.l6?.survivors.length, 24, 29);
      add('L6-01', 'initial shelter roster full health', initial.census.filter(e => initial.mission.l6?.survivors.some(survivor => survivor.id === e.id)).map(e => ({ id: e.id, hp: e.hp, maxHp: e.maxHp })), 'every resident starts full health', initial.mission.l6?.survivors.length ? initial.mission.l6.survivors.every(survivor => { const entity = initial.census.find(e => e.id === survivor.id); return !!entity && entity.hp === entity.maxHp; }) : undefined);
      number('L6-02', 'new weapon pickup census', initial.census.filter(e => e.pickup && 'actionId' in e.pickup).length, 0, 0);
      // Use the committed breach event: checkpoint restore shifts future mission
      // timers, so the final scheduled deadline can be later than the actual breach.
      const breach1 = observation.ledger.find(event => event.type === 'l6.breach1');
      const breach2 = observation.ledger.find(event => event.type === 'l6.breach2');
      const bang = observation.ledger.find(event => event.type === 'l6.bang' && event.breach === 1);
      number('L6-03', 'first breach level clock', breach1 ? breach1.tick / 60 : null, 30, 40);
      number('L6-03', 'first breach bang lead', breach1 && bang ? (breach1.tick - bang.tick) / 60 : null, 1.5, Infinity);
      number('L6-03', 'actual first-wave spawn admissions (floor traversal still open)', s6?.spawnLog.filter(entry => entry.wave === 1).length, 6, Infinity);
      number('L6-04', 'second breach delay', breach1 && breach2 ? (breach2.tick - breach1.tick) / 60 : null, 20, 30);
      number('L6-04', 'second-wave admitted identities', s6?.spawnLog.filter(entry => entry.wave === 2).length, 10, Infinity);
      number('L6-04', 'second-wave source accesses', s6 ? new Set(s6.spawnLog.filter(entry => entry.wave === 2).map(entry => entry.door)).size : null, 2, Infinity);
      if (!competent) for (const name of ['l6.breach1', 'l6.breach2']) {
        const wave = threat?.waves.find(wave => wave.key === name);
        add('L6-05', `stationary first attack after ${name}`, wave?.firstAttackSeconds ?? null, 'player windup≤15s after this breach caption', wave?.firstAttackSeconds != null ? wave.firstAttackSeconds <= 15 : wave && wave.observedSeconds >= 15 ? false : undefined);
      }
      if (competent) {
        add('L6-07', 'ordinary retreat route completion', receipt.run?.outcome, 'complete', receipt.run?.completed);
        number('L6-07', 'retreat player/group windups per minute', phase('step/retreat') ? phase('step/retreat')!.attacksPerMinute + phase('step/retreat')!.groupAttacksPerMinute : null, 4, Infinity);
        number('L6-07', 'actual HP lost during retreat', observation.l6RetreatDamage, 30, Infinity);
        number('L6-07', 'retreat concurrent infected cap', observation.phasePeaks.retreat?.alive, 0, low ? 30 : 60);
        const result = state.result;
        add('L6-12', 'result roster accounting', result ? { in: result.survivorsIn, out: result.rescued, lost: result.survivorsLost } : null, 'in = out + lost', result?.survivorsIn !== undefined && result.survivorsLost !== undefined ? result.survivorsIn === result.rescued + result.survivorsLost : undefined);
      }
      break;
    }
    case 'L7': {
      const corridorPath='docs/reports/fix55-c/L7-corridor.json';
      if(competent&&existsSync(corridorPath)){
        const proof=JSON.parse(readFileSync(corridorPath,'utf8')) as {sourceHash:string;observerHash:string;toolSha256:string;rows:{tier:string;controlIdentical:boolean;nativeStateHash:string;initial:{id:number;archetype:string;hp:number;hidden?:boolean;pending?:boolean}[];crossings:unknown[]}[]};
        const row=proof.rows.find(row=>row.tier===receipt.tier);
        if(proof.sourceHash===receipt.sourceHash&&proof.observerHash===receipt.observerHash&&proof.toolSha256===createHash('sha256').update(readFileSync('tools/qa/accept/fix55-l7-corridor.ts')).digest('hex')&&row?.controlIdentical&&row.nativeStateHash===receipt.nativeStateHash){
          const regulars=row.initial.filter(e=>e.archetype==='infected.runner'),alphas=row.initial.filter(e=>e.archetype==='infected.alpha');
          add('L7-08','initial live final-corridor cohort',{regulars,alphas},`at least${low?60:120} live regulars and2Alphas admitted before first tick`,regulars.length>=(low?60:120)&&alphas.length>=2&&row.initial.every(e=>e.hp>0&&!e.hidden&&!e.pending),corridorPath);
          add('L7-08','observed native survivor crossing prior rocket footprint',row.crossings,'living visible unboarded human beyondx=-68 within6m of an earlier actual rocket impact; zero observations remain inconclusive',row.crossings.length>0?true:undefined,corridorPath);
        }
      }

      const launcher = initial.census.find(entity => entity.pickup && 'actionId' in entity.pickup && entity.pickup.actionId === 'weapon.rocket-launcher'), exit = initial.checkpoints.find(checkpoint => checkpoint.id === 'night-exit');
      number('L7-01', 'native launcher horizontal distance from night-exit checkpoint', launcher && exit ? Math.hypot(launcher.x - exit.position[0], launcher.z - exit.position[2]) : null, 0, 5);
      number('L7-02', 'selectable story weapons after native launcher pickup', [...new Set([...(final.racks?.LEFT ?? []), ...(final.racks?.RIGHT ?? [])])].filter(id => allowed.includes(id)).length, 6, 6);
      if (competent) {
        const proofPath = 'docs/reports/fix51-verify/receipts/L7-arrival.json';
        const producerPath = 'docs/reports/fix51-r10c/L7-carried-save-provenance.json';
        if (existsSync(proofPath) && existsSync(producerPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as { sourceHash: string; observerHash: string; toolSha256: string; rows: { tier: string; expectedIds: number[]; initial: { id: number; hp: number; max: number }[]; idsMatch: boolean; allFullHealth: boolean; formationTicks: number; samples: number; minimumClearance: number; storyWeapons: string[]; nativeStateHash: string; controlHash: string; controlIdentical: boolean }[] };
          const producer = JSON.parse(readFileSync(producerPath, 'utf8')) as { sourceHash: string; toolSha256: string; rows: { tier: string; archiveSha256: string; roster: { id: number }[] }[] };
          const result = proof.rows.find(item => item.tier === receipt.tier), seed = producer.rows.find(item => item.tier === receipt.tier);
          const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
          const fresh = proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === sha('tools/qa/accept/l7-arrival-r10.ts') && producer.sourceHash === receipt.sourceHash && producer.toolSha256 === sha('tools/qa/accept/l7-carried-save-r10.ts') && seed?.archiveSha256 === sha(`docs/reports/fix51-r10c/L7-${receipt.tier}-carried-save.json.gz`) && result?.nativeStateHash === result?.controlHash && result?.controlIdentical;
          if (fresh && result && seed) add('L7-02', 'actual L6 carried identities full-health formation and arsenal', result, 'exact nonempty L6 roster; full HP; every first-ten-second relative segment clears actual body radii; six story weapons; control identical', result.initial.length > 0 && result.idsMatch && result.allFullHealth && JSON.stringify(result.expectedIds) === JSON.stringify(seed.roster.map(actor => actor.id).sort((a, b) => a - b)) && result.formationTicks === 600 && result.samples > 0 && result.minimumClearance >= 0 && result.storyWeapons.length === 6, proofPath);
        }
      }
      if (competent && receipt.run?.completed) {
        // The runner prepares L7's resident encounters before beforeBegin installs
        // the spawn observer. Its initial census and later birth transactions are
        // disjoint: l7.started is still false in this first-tick snapshot.
        const residents = (archetype: string) => initial.census.filter(e => e.infected && e.hp > 0 && e.archetype === archetype).length;
        number('L7-04', 'actual resident and later regular admissions', residents('infected.runner') + (observation.births['infected.runner'] ?? 0), low ? 200 : 400, Infinity);
        number('L7-04', 'actual resident and later Alpha admissions', residents('infected.alpha') + (observation.births['infected.alpha'] ?? 0), 4, 6);
      }
      number('L7-04', 'concurrent cap', observation.peakAlive, 0, low ? 100 : 200);
      if (competent) {
        const ids = new Set(observation.markerChanges.filter(change => change.step.includes('corridor') && change.marker).map(change => change.marker));
        add('L7-07', 'corridor marker identity changes', [...ids], 'one fixed corridor destination', ids.size ? ids.size === 1 : undefined);
        const counterPath = 'docs/reports/fix51-verify/receipts/L7-counter.json';
        if (existsSync(counterPath)) {
          const proof = JSON.parse(readFileSync(counterPath, 'utf8')) as { sourceHash: string; observerHash: string; toolSha256: string; rows: { tier: string; samples: number; mismatches: number; movingMarkers: number; nativeStateHash: string; controlIdentical: boolean }[] };
          const result = proof.rows.find(item => item.tier === receipt.tier);
          const hash = createHash('sha256').update(readFileSync('tools/qa/accept/l7-counter-r10.ts')).digest('hex');
          const fresh = proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === hash && result?.nativeStateHash === receipt.nativeStateHash && result.controlIdentical;
          if (fresh && result) add('L7-07', 'every corridor HUD counter matches independent live roster census', result, 'nonempty sample; zero count mismatches and zero moving marker ticks', result.samples > 0 ? result.mismatches === 0 && result.movingMarkers === 0 : undefined, counterPath);
        }
        const board = final.departure?.boarded ?? [], roster = final.l7?.roster.filter(entry => entry.status === 'following') ?? [];
        add('L7-10', 'every living roster identity boarded', { alive: roster.map(entry => entry.id), boarded: board }, 'all living followers are in boarded ledger', final.departure?.phase === 'done' ? roster.every(entry => board.includes(entry.id)) : undefined);
      }
      break;
    }
    case 'L8': {
      number('L8-01', 'observed route weapon pickup transactions', observation.pickups.filter(pickup => pickup.item?.startsWith('weapon.')).length, 0, 0);
      number('L8-01', 'new weapon pickup census', initial.census.filter(e => e.pickup && 'actionId' in e.pickup).length, 0, 0);
      add('L8-02', 'native calm marker and infected attack event state (HUD text requires browser)', observation.calm, '3600 ticks ±1; destination marker present for the 3599 observable calm ticks; zero combat events', Math.abs(observation.calm.ticks - 3600) <= 1 && observation.calm.markerTicks >= 3599 && observation.calm.combatEvents === 0);
      const markerChanges = observation.markerChanges as { tick: number; step: string; marker: string | null }[];
      const plaza = markerChanges.find(change => change.step === 'sanctuary' && change.marker === 'central-plaza');
      const hold = markerChanges.find(change => change.tick >= 3600 && change.tick < 5400 && change.marker === null);
      const apc = markerChanges.find(change => change.step === 'escape' && change.marker === 'exit');
      const noEarlyExit = markerChanges.every(change => change.marker !== 'exit' || change.tick >= 5400);
      add('L8-02', 'PO 2026-11-08: plaza tour, markerless defence, then APC route', { plaza, hold, apc, noEarlyExit }, 'central-plaza active from first tick; markerless defence from tick3600; APC marker only after tick5400 and the plaza rendezvous', !!plaza && plaza.tick <= 1 && !!hold && !!apc && apc.tick >= 5400 && noEarlyExit);
      number('L8-03', 'initial human civilians excluding soldiers and animals', initial.census.filter(e => e.civilian && !e.animal && e.role !== 'soldier').length, 20, Infinity);
      number('L8-03', 'initial soldiers', initial.census.filter(e => e.role === 'soldier').length, 6, Infinity);
      number('L8-03', 'initial zoo animals', initial.census.filter(e => e.animal).length, 8, Infinity);
      number('L8-03', 'initial animal species', new Set(initial.census.flatMap(e => e.animal ? [e.animal] : [])).size, 5, 5);
      number('L8-03', 'initial zebras', initial.census.filter(e => e.animal === 'zebra').length, 2, Infinity);
      number('L8-03', 'initial flamingos', initial.census.filter(e => e.animal === 'flamingo').length, 3, Infinity);
      const zoo = final.l8;
      number('L8-04', 'breach active-sim clock', zoo?.breachedAt ? zoo.breachedAt - zoo.startedAt : null, 3599, 3601);
      number('L8-04', 'distinct tunnel outlets', zoo?.outlets.length, 3, Infinity);
      if (competent && receipt.run?.completed) number('L8-05', 'actual admitted Alphas over observed route', zoo?.alphas, 3, 5);
      number('L8-05', 'concurrent cap', observation.peakAlive, 0, low ? 100 : 200);
      const enclosurePath='docs/reports/fix55-c/L8-enclosure-paths.json';
      if(competent&&existsSync(enclosurePath)){
        const proof=JSON.parse(readFileSync(enclosurePath,'utf8')) as L8PathProof;
        const row=proof.rows.find(row=>row.tier===receipt.tier);
        if(proof.sourceHash===receipt.sourceHash&&proof.observerHash===receipt.observerHash&&proof.toolSha256===createHash('sha256').update(readFileSync('tools/qa/accept/fix55-l8-paths.ts')).digest('hex')&&row){
          const pass=row.clearanceRadius===1.25&&['lion','gorilla','elephant','zebra','flamingo'].every(species=>{
            const enclosure=row.enclosures.find(enclosure=>enclosure.species===species);
            return enclosure&&['north','south'].every(direction=>enclosure.gates.some(gate=>gate.direction===direction&&gate.endpoints&&gate.crossing&&gate.interiorMetres!==null&&gate.escapeMetres!==null&&gate.negativeBlocked));
          });
          add('L8-07','two independent body-clear enclosure exits at2.5m width',row,'all five enclosures have north/south interior paths, explicit gate crossings, and external paths to APC;1.25m clearance; gate-blocking negative controls',pass,enclosurePath);
        }
      }
      const outbreakProofPath = 'docs/reports/fix55-c/L8-05-native.json';
      if (existsSync(outbreakProofPath)) {
        const proof = JSON.parse(readFileSync(outbreakProofPath,'utf8')) as {
          sourceHash:string; observerHash:string; toolSha256:string;
          rows:{ tier:string; policy:string; nativeStateHash:string; controlIdentical:boolean;
            hits:{victimClass:string}[]; initial:{victimClass:string}[];
            arrivals:{outlet:number;tick:number;observedTick:number;alpha:boolean;inNativeCamera:boolean}[];
            markers:{tick:number;marker:string|null;anchor:{x:number;z:number}|null}[];
            finalBoarding:{carId:number;roster:{id:number;hp:number;infected:boolean;passengerOf:number|null}[]};
            turns:{id:number;endTick:number|null;seconds:number|null;initial?:{species:string|null};finalArchetype:string|null}[] }[];
        };
        const result=proof.rows.find(row=>row.tier===receipt.tier&&row.policy===receipt.policy);
        const toolSha256=createHash('sha256').update(readFileSync('tools/qa/accept/fix53-l8-observer.ts')).digest('hex');
        if (proof.sourceHash===receipt.sourceHash&&proof.observerHash===receipt.observerHash&&proof.toolSha256===toolSha256&&result?.controlIdentical&&result.nativeStateHash===receipt.nativeStateHash) {
          add('L8-03', 'initial zoo staff identities', result.initial.filter(actor=>actor.victimClass==='staff').length, 'at least4 staff', result.initial.filter(actor=>actor.victimClass==='staff').length>=4, outbreakProofPath);
          const firstPacket=result.arrivals.filter(actor=>!actor.alpha&&actor.tick===zoo?.breachedAt);
          const outlets=[...new Set(firstPacket.map(actor=>actor.outlet))];
          const starts=outlets.map(outlet=>Math.min(...firstPacket.filter(actor=>actor.outlet===outlet).map(actor=>actor.observedTick)));
          add('L8-04','actual first packet per tunnel outlet',outlets.map(outlet=>({outlet,count:firstPacket.filter(actor=>actor.outlet===outlet).length})),`at least3 outlets, each ${low?3:6} initial infected`,outlets.length>=3&&outlets.every(outlet=>firstPacket.filter(actor=>actor.outlet===outlet).length>=(low?3:6)),outbreakProofPath);
          add('L8-04','first ordinary visible actor outlet start window',starts,'all first outlet actors visible within60ticks',starts.length>=3&&Math.max(...starts)-Math.min(...starts)<=60,outbreakProofPath);
          const distances=(zoo?.outlets??[]).flatMap((outlet,i,all)=>all.slice(i+1).map(other=>Math.hypot(outlet.x-other.x,outlet.z-other.z)));
          add('L8-04','actual tunnel outlet separation',distances,'at least3 outlets; every pair at least20m',distances.length>=3&&distances.every(distance=>distance>=20));
          if(competent&&receipt.run?.completed){
            const boarding=result.finalBoarding, living=boarding.roster.filter(actor=>actor.hp>0&&!actor.infected);
            add('L8-09','every living native group identity seated',living,'nonempty living group; each passengerOf is the departure APC',living.length>0&&living.every(actor=>actor.passengerOf===boarding.carId),outbreakProofPath);
            const marked=result.markers.filter(marker=>marker.marker==='exit');
            add('L8-07','native escape marker remains fixed at APC',marked,'every nonempty marker is exit at the unchanged APC anchor',marked.length>0&&marked.every(marker=>marker.marker==='exit'&&marker.anchor?.x===marked[0].anchor?.x&&marker.anchor?.z===marked[0].anchor?.z),outbreakProofPath);
          }
          for (const kind of ['civilian','soldier','staff','animal']) {
            const hits=result.hits.filter(hit=>hit.victimClass===kind);
            add('L8-05',`actual infected hits on ${kind}`,hits,`at least one landed infected hit on ${kind} during the full observed outbreak`,hits.length>0?true:undefined,outbreakProofPath);
          }
          const bitePath='docs/reports/fix55-c/L8-bite-fixtures.json';
          if(competent&&existsSync(bitePath)){
            const bites=JSON.parse(readFileSync(bitePath,'utf8')) as {sourceHash:string;toolSha256:string;rows:{tier:string;targets:{kind:string;id:number;species:string|null}[];hits:{kind:string;targetId:number;tick:number;successfulBite?:boolean}[];turns:{kind:string;id:number;start:number;seconds:number|null;archetype:string|null}[];peak:number;cap:number}[]};
            const fixture=bites.rows.find(row=>row.tier===receipt.tier);
            if(bites.sourceHash===receipt.sourceHash&&bites.toolSha256===createHash('sha256').update(readFileSync('tools/qa/accept/fix55-l8-bites.ts')).digest('hex')&&fixture){
              const classes=['civilian','soldier','staff','animal'].map(kind=>({kind,canonical:result.hits.filter(hit=>hit.victimClass===kind).length,localFixture:fixture.hits.filter(hit=>kind==='animal'?['lion','gorilla','elephant','zebra','flamingo'].includes(hit.kind):hit.kind===kind).length}));
              add('L8-05','unprotected local-threat victim class coverage',{classes,fixturePeak:fixture.peak,fixtureCap:fixture.cap},'landed damage or successful production outbreak.bite on civilian/soldier/staff/animal; NPCs unprotected and ordinary stats; canonical damage plus explicit local-threat capability fixtures',classes.every(row=>row.canonical+row.localFixture>0)&&fixture.peak<=(low?100:200),bitePath);
              const species=['lion','gorilla','elephant','zebra','flamingo'];
              const turns=species.map(species=>{const target=fixture.targets.find(target=>target.kind===species),turn=fixture.turns.find(turn=>turn.id===target?.id);return {species,target,turn,bite:fixture.hits.find(hit=>hit.targetId===target?.id&&hit.successfulBite)};});
              add('L8-05','all five same-ID species convert after actual bites',turns,'all five actual healthy targets bitten, sameID/species,2.5–3.5s from first bite/stagger start; unchanged caps',turns.every(row=>row.target?.species===row.species&&row.turn&&row.bite&&row.turn.start===row.bite.tick&&row.turn.seconds!==null&&row.turn.seconds>=2.5&&row.turn.seconds<=3.5&&row.turn.archetype===`infected.${row.species}`),bitePath);
            }
          }
          const animals=result.turns.filter(turn=>turn.initial?.species&&turn.endTick!==null);
          add('L8-05','observed same-ID animal turn timing and species',animals,'observed completed turns retain species and ID;2.5–3.5s; empty coverage is inconclusive',animals.length?animals.every(turn=>turn.seconds!==null&&turn.seconds>=2.5&&turn.seconds<=3.5&&turn.finalArchetype===`infected.${turn.initial!.species}`):undefined,outbreakProofPath);
        }
      }
      break;
    }
    case 'L9': {
      const hits = observation.ledger.filter(event => event.type === 'vehicle.durability-hit');
      add('L9-04', 'actual contact/attack durability transactions', hits, 'after = max(0, before−10) for contact and attack', hits.length ? hits.every(event => event.type !== 'vehicle.durability-hit' || event.source === 'obstacle' || event.after === Math.max(0, event.before - 10)) : undefined);
      const signals = observation.ledger.filter(event => event.type === 'mission.signal');
      number('L9-07', 'crash impact count on ordinary route', signals.filter(event => event.type === 'mission.signal' && event.name === 'l9.crash-impact').length, 1, 1);
      const wreckObjective = observation.ledger.find(event => event.type === 'objective.started' && event.id === 'reach-outskirts'), impact = signals.find(event => event.type === 'mission.signal' && event.name === 'l9.crash-impact');
      add('L9-07', 'wreck objective starts after crash impact', { objectiveTick: wreckObjective?.tick, impactTick: impact?.tick }, 'objectiveTick ≥ impactTick', wreckObjective && impact ? wreckObjective.tick >= impact.tick : undefined);
      number('L9-09', 'detailed resident chunk peak', observation.maxDetailedChunks, 0, low ? 9 : 25);
      break;
    }
    case 'L10': {
      const cameraPath='docs/reports/fix56-c/L10-camera.json';
      if(competent&&existsSync(cameraPath)){
        const proof=JSON.parse(readFileSync(cameraPath,'utf8')) as {sourceHash:string;toolSha256:string;rows:{tier:string;position:{id:string};regionScale:number;playerZoom:number;combined:number;expectedBase:number;basePass:boolean;maxPass:boolean}[]};
        const rows=proof.rows.filter(row=>row.tier===receipt.tier);
        if(proof.sourceHash===receipt.sourceHash&&proof.toolSha256===createHash('sha256').update(readFileSync('tools/qa/accept/fix55-l10-camera.ts')).digest('hex')&&rows.length===6){
          add('L10-08','production road and finale base framing',rows,'road base1.3; corridor/finale base1; actual View rig',rows.every(row=>Math.abs(row.regionScale-(row.position.id==='road'?1.3:1))<1e-8),cameraPath);
          add('L10-08','production base times maximum user zoom',rows,'every ordinary and rocket-equipped camera combination≤2.0',rows.every(row=>Math.abs(row.combined-row.regionScale*row.playerZoom)<1e-8&&row.combined<=2+1e-8),cameraPath);
        }
      }
      const pursuitPath='docs/reports/fix56-c/L10-pursuit.json';
      if(competent&&existsSync(pursuitPath)){
        const proof=JSON.parse(readFileSync(pursuitPath,'utf8')) as {sourceHash:string;observerHash:string;toolSha256:string;rows:{tier:string;controlIdentical:boolean;nativeStateHash:string;persistentIds:number[];maxStepMetres:number;longestFarStallSeconds:number;cruiseMedianRunRatio:number|null;cruiseSamples:number;movingWithoutLosSamples:number;relocations:{writer:string;metres:number}[];cues:{tick:number;kind:string;sourceId:number;distance:number|null}[]}[]};
        const row=proof.rows.find(row=>row.tier===receipt.tier);
        if(proof.sourceHash===receipt.sourceHash&&proof.observerHash===receipt.observerHash&&proof.toolSha256===createHash('sha256').update(readFileSync('tools/qa/accept/fix55-l10-pursuit.ts')).digest('hex')&&row&&row.nativeStateHash===receipt.nativeStateHash){
          add('L10-07','observed ordinary cruise ratio to nominal player run',{ratio:row.cruiseMedianRunRatio,samples:row.cruiseSamples},'0.7× run ±2%; ordinary moving far-pursuit samples exclude specials',row.cruiseMedianRunRatio!==null&&Math.abs(row.cruiseMedianRunRatio-.7)<=.7*.02,pursuitPath);
          const nonContactRelocations=row.relocations.filter(event=>event.writer!=='special.swept-contact'||event.metres>1);
          add('L10-07','continuous same-ID pursuit without LOS or teleport',{ids:row.persistentIds,maxStepMetres:row.maxStepMetres,longestFarStallSeconds:row.longestFarStallSeconds,blindMovingSamples:row.movingWithoutLosSamples,relocations:row.relocations,nonContactRelocations},'one persistent actor; no>1m step or non-contact relocation; nonzero movement without LOS; no far stall>20s',row.persistentIds.length===1&&row.maxStepMetres<=1&&!nonContactRelocations.length&&row.movingWithoutLosSamples>0&&row.longestFarStallSeconds<=20,pursuitPath);
          const roars=row.cues.filter(cue=>cue.kind==='roar'),gaps=roars.slice(1).map((cue,i)=>(cue.tick-roars[i].tick)/60);
          add('L10-07','actual paired roar/impact intervals',{gaps,events:row.cues.filter(cue=>cue.kind!=='step')},'nonempty intervals20–35s; every roar has same-tick same-ID impact; actual sound gain remains separate',gaps.length>0&&gaps.every(gap=>gap>=20&&gap<=35)&&roars.every(roar=>row.cues.some(cue=>cue.kind==='impact'&&cue.tick===roar.tick&&cue.sourceId===roar.sourceId)),pursuitPath);
        }
      }

      const bounds: Record<string, number[]> = {
        'residential-fringe': low ? [8, 16] : [12, 24], 'industrial-area': low ? [16, 28] : [25, 45],
        'military-zone': low ? [28, 45] : [45, 75], 'research-campus': low ? [35, 55] : [55, 85],
        'destroyed-corridor': low ? [50, 75] : [80, 130], 'dispersal-complex': low ? [75, 95] : [140, 190],
      };
      for (const [region, [minimum, maximum]] of Object.entries(bounds)) {
        const census = observation.regions[region];
        // R2 explicitly adds dogs to its regular-human range. Later-region
        // totals include specials, with the pursuing Mega measured separately.
        const peak = region === 'residential-fringe' ? census?.regularPeak : census?.normalPeak;
        const full = competent && receipt.run?.completed;
        add('L10-03', `${region} normal local concurrent peak bound`, census ?? null, `${region === 'residential-fringe' ? 'regular human' : 'normal infected'} peak ${minimum}–${maximum}; species/group clauses remain open`, peak === undefined ? undefined : peak > maximum || full && peak < minimum ? false : full && peak >= minimum ? true : undefined);
      }
      const composition: Record<string, { dogs: [number, number]; alphas?: [number, number] }> = {
        'residential-fringe': { dogs: [1, 2] }, 'industrial-area': { dogs: [2, 4], alphas: [1, 1] },
        'military-zone': { dogs: [2, 4], alphas: [1, 2] }, 'research-campus': { dogs: [2, 4], alphas: [1, 2] },
        'destroyed-corridor': { dogs: [3, 5], alphas: [2, 3] },
      };
      for (const [region, targets] of Object.entries(composition)) {
        const census = observation.regions[region];
        number('L10-03', `${region} concurrent dog peak`, census?.dogPeak, ...targets.dogs);
        if (targets.alphas) number('L10-03', `${region} concurrent Alpha peak`, census?.alphaPeak, ...targets.alphas);
      }
      for (const [region, groups, bounds] of [
        ['military-zone', ['military-breach', 'military-column', 'military-exit'], [10, 20]],
        ['destroyed-corridor', ['corridor-line', 'corridor-breach', 'corridor-exit'], [20, 35]],
      ] as const) for (const group of groups) number('L10-03', `${group} regular group size`, observation.regions[region]?.regularGroupPeaks?.[group], bounds[0], bounds[1]);
      if (competent) {
        const proofPath = 'docs/reports/fix51-verify/receipts/L10-fringe-dogs.json';
        if (existsSync(proofPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as { sourceHash: string; observerHash: string; toolSha256: string; rows: { tier: string; pickupTick: number | null; firstDogTick: number | null; prematureTicks: number; nativeStateHash: string; controlIdentical: boolean }[] };
          const result = proof.rows.find(item => item.tier === receipt.tier);
          const toolSha256 = createHash('sha256').update(readFileSync('tools/qa/accept/l10-fringe-dogs-r10.ts')).digest('hex');
          const fresh = proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === toolSha256 && result?.nativeStateHash === receipt.nativeStateHash && result.controlIdentical;
          if (fresh && result) add('L10-03', 'residential dogs follow actual handgun pickup', result, 'pickup observed; first admitted dog at or after pickup; zero dog ticks before pickup', result.pickupTick !== null && result.firstDogTick !== null ? result.firstDogTick >= result.pickupTick && result.prematureTicks === 0 : undefined, proofPath);
        }
      }
      if (competent) {
        const proofPath = 'docs/reports/fix51-r10c/L10-pickups-proof.json';
        if (existsSync(proofPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as {
            sourceHash: string; observerHash: string; toolSha256: string;
            rows: { tier: string; nativeStateHash: string; controlIdentical: boolean; inventorySeconds: number; inventoryOnlyIdentical: boolean;
              acquisitions: { weapon: string; tick: number; interact: boolean; checkpoint: string | null; snapshotTick: number | null; snapshotWeapons: string[]; expectedDistance: number | null; expectedRadius: number | null }[];
              inventoryCases: { weapon: string; identical: boolean; cases: { add: string[]; before: number; births: unknown[]; censusSha256: string; checkpoint: string | null }[] }[] }[];
          };
          const result = proof.rows.find(row => row.tier === receipt.tier);
          const toolSha256 = createHash('sha256').update(readFileSync('tools/qa/accept/l10-pickups-r10.ts')).digest('hex');
          if (proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === toolSha256 && result?.nativeStateHash === receipt.nativeStateHash && result.controlIdentical) {
            const targets = [['weapon.pistol', 'cure-residential'], ['weapon.shotgun', 'cure-industrial'], ['weapon.army-mg', 'cure-military'], ['weapon.rocket-launcher', 'cure-corridor']];
            const acquisitionsPass = result.acquisitions.length === 4 && targets.every(([weapon, checkpoint]) => {
              const rows = result.acquisitions.filter(row => row.weapon === weapon);
              return rows.length === 1 && rows.every(row => row.checkpoint === checkpoint && row.interact && row.snapshotTick === row.tick && row.snapshotWeapons.includes(weapon) && row.expectedDistance !== null && row.expectedDistance <= 2 && row.expectedRadius === 2);
            });
            add('L10-05', 'all four named checkpoint pickup and snapshot transactions', result.acquisitions, 'exactly four expected weapons; named anchor distance≤2m; actual approach interaction; same-tick checkpoint includes weapon', acquisitionsPass, proofPath);
            const inventoryPass = result.inventorySeconds === 4 && result.inventoryOnlyIdentical && result.inventoryCases.length === 4 && targets.every(([weapon]) => {
              const row = result.inventoryCases.find(row => row.weapon === weapon), baseline = row?.cases[0];
              return row?.identical && row.cases.length === 3 && baseline?.add.length === 0 && baseline.births.length === 0 && row.cases.every(test => test.births.length === 0 && test.before === baseline.before && test.censusSha256 === baseline.censusSha256 && test.checkpoint === baseline.checkpoint) && row.cases.some(test => test.add.length === 1 && test.add[0] === weapon) && row.cases.some(test => test.add.length === 4);
            });
            add('L10-05', 'inventory changes alone spawn zero enemies at every weapon approach', result.inventoryCases, 'four naturally reached pre-pickup Resume snapshots; unchanged baseline vs named/all weapons; zero births and identical every-tick infected census for4s', inventoryPass, proofPath);
          }
        }
      }
      if (competent) {
        const proofPath = 'docs/reports/fix51-r10c/L10-cure-proof.json';
        if (existsSync(proofPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as {
            sourceHash: string; observerHash: string; toolSha256: string;
            rows: { tier: string; nativeStateHash: string; controlIdentical: boolean;
              grant: { tick: number; before: unknown; after: unknown; carried: boolean; installed: boolean; item: boolean } | null;
              movement: unknown; controlledMovement?: { move: { x: number; z: number }; ticks: number; identical: boolean; cases: { carried: boolean; displacement: number; trajectorySha256: string; finalCarried: boolean; finalItem: boolean }[] }[] }[];
          };
          const result = proof.rows.find(row => row.tier === receipt.tier);
          const toolSha256 = createHash('sha256').update(readFileSync('tools/qa/accept/l10-cure-r10.ts')).digest('hex');
          if (proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === toolSha256 && result?.nativeStateHash === receipt.nativeStateHash && result.controlIdentical) {
            const grant = result.grant;
            add('L10-09', 'actual cure grant preserves both weapon racks', grant, 'actual canister acquisition; carried item true, installed false; exact unchanged LEFT/RIGHT racks', grant ? grant.tick > 0 && grant.carried && grant.item && !grant.installed && JSON.stringify(grant.before) === JSON.stringify(grant.after) : undefined, proofPath);
            const controls = result.controlledMovement;
            const directions = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
            const movementPass = controls?.length === 4 && directions.every(move => {
              const tests = controls.filter(row => row.move.x === move.x && row.move.z === move.z);
              const test = tests[0], baseline = test?.cases.find(row => !row.carried), carried = test?.cases.find(row => row.carried);
              return tests.length === 1 && test.ticks === 120 && test.identical && test.cases.length === 2 && baseline && carried && !baseline.finalCarried && !baseline.finalItem && carried.finalCarried && carried.finalItem && /^[a-f0-9]{64}$/.test(baseline.trajectorySha256) && baseline.trajectorySha256 === carried.trajectorySha256;
            }) && controls.some(test => test.cases.every(row => row.displacement >= 4));
            add('L10-09', 'canister-only controlled movement trajectories', { routeWindows: result.movement, controls }, 'same production Resume; only canister flag/item differ; four cardinal keyboard inputs for120ticks; identical every-tick XYZ; at least one unblocked ≥4m traversal', controls ? movementPass : undefined, proofPath);
          }
        }
      }
      const outskirts = observation.regions['crash-outskirts'];
      number('L10-01', 'R1 concurrent regular peak', competent && receipt.run?.completed ? outskirts?.regularPeak : null, 4, 8);
      for (const group of ['crash-singletons', 'crash-road-pair', 'crash-bend', 'crash-pair']) number('L10-01', `${group} regular group size`, competent && receipt.run?.completed ? outskirts?.regularGroupPeaks?.[group] : null, 1, 2);
      const first = observation.firstMinute;
      number('L10-01', 'first-minute regular infected peak', first.ticks >= 3599 ? first.regularPeak : null, 0, 8);
      number('L10-01', 'first-minute dog peak', first.ticks >= 3599 ? first.dogPeak : null, 0, 0);
      number('L10-01', 'first-minute Alpha peak', first.ticks >= 3599 ? first.alphaPeak : null, 0, 0);
      number('L10-02', 'actual Mega introduction time', observation.megaIntroduction ? observation.megaIntroduction.tick / 60 : null, 0, 120);
      number('L10-02', 'Mega distance on introduction', observation.megaIntroduction?.distance, 80, Infinity);
      if (competent) {
        const proofPath = 'docs/reports/fix51-r10c/L10-introduction-proof.json';
        if (existsSync(proofPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as {
            sourceHash: string; observerHash: string; toolSha256: string;
            rows: { tier: string; nativeStateHash: string; controlIdentical: boolean; cues: { tick: number; kind: string; sourceId: number }[]; introduction: { id: number; tick: number; direct: number; pathMetres: number | null; hidden: boolean } | null }[];
          };
          const result = proof.rows.find(row => row.tier === receipt.tier);
          const toolSha256 = createHash('sha256').update(readFileSync('tools/qa/accept/l10-intro-r10.ts')).digest('hex');
          if (proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === toolSha256 && result?.nativeStateHash === receipt.nativeStateHash && result.controlIdentical) {
            const intro = result.introduction;
            add('L10-02', 'actual Mega roar and impact introduction events', result.cues, 'same persistent Mega emits roar and impact by tick7200', intro ? ['roar', 'impact'].every(kind => result.cues.some(cue => cue.kind === kind && cue.sourceId === intro.id && cue.tick <= 7200 && cue.tick >= intro.tick)) : undefined, proofPath);
            add('L10-02', 'Mega introduction actual body-clear route', intro, 'reachable own-clearance route; inactive streaming window is inconclusive', intro?.pathMetres !== null && intro?.pathMetres !== undefined ? Number.isFinite(intro.pathMetres) : undefined, proofPath);
          }
        }
      }

      if (competent) for (const [id, region] of Object.entries(observation.regions)) {
        const minimum = ['crash-outskirts', 'residential-fringe'].includes(id) ? 2 : 4;
        number('L10-04', `${id} player windups per minute`, region.ticks > 60 ? region.attacks * 3600 / region.ticks : null, minimum, Infinity);
      }
      const competentHold = phase('step/hold');
      if (competent) {
        number('L10-11', 'competent hold player windups per minute', competentHold?.attacksPerMinute ?? null, 8, Infinity);
        number('L10-11', 'competent hold bounded-path reachable share', competentHold?.boundedPaths?.minimumPercent ?? null, 90, 100);
      } else {
        const proofPath = 'docs/reports/fix51-verify/receipts/L10-hold.json';
        if (existsSync(proofPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as {
            sourceHash: string; observerHash: string; toolSha256: string; rows: { tier: string; activationTick: number | null; arenaAfterActivationSeconds: number | null; observedSeconds: number; peakAlive: number; nativeStateHash: string; controlIdentical: boolean; persistentMegaIds?: number[]; scheduledRelocations?: { tick: number; id: number; writer: string; metres: number }[]; phases: PhaseReceipt[] }[];
          };
          const result = proof.rows.find(item => item.tier === receipt.tier);
          const expectedToolHash = createHash('sha256').update(readFileSync('tools/qa/accept/l10-hold-r10.ts')).digest('hex');
          const fresh = proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.toolSha256 === expectedToolHash && result?.nativeStateHash === receipt.nativeStateHash && result.controlIdentical;
          if (fresh && result) {
            const mega = result.phases.find(item => item.key === 'step/mega');
            const peakBounds = receipt.tier === 'low' ? [75, 95] : [140, 190];
            number('L10-11', 'full active assault hold duration', result.observedSeconds, 240, 240);
            number('L10-11', 'capped active infected peak', result.peakAlive, peakBounds[0], peakBounds[1]);
            number('L10-11', 'hold player windups per minute', mega?.attacksPerMinute ?? null, 8, Infinity);
            number('L10-11', 'hold bounded-path reachable share', mega?.boundedPaths?.minimumPercent ?? null, 90, 100);
            number('L10-11', 'Mega arena arrival after charge activation', result.arenaAfterActivationSeconds, 120, 160);
            for (const id of ['L10-07', 'L10-11']) add(id, 'persistent Mega identity without scheduled replacement or teleport', { ids: result.persistentMegaIds, relocations: result.scheduledRelocations }, 'one persistent ID; zero scheduled relocations (E32-AC21)', result.persistentMegaIds && result.scheduledRelocations ? result.persistentMegaIds.length === 1 && result.scheduledRelocations.length === 0 : undefined, proofPath);
          }
        }
      }
      if (competent) {
        const proofPath = 'docs/reports/fix51-verify/receipts/L10-regional-reach.json';
        if (existsSync(proofPath)) {
          const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as {
            sourceHash: string; observerHash: string; codeHash: string; results: { tier: string; sourceHash: string; observerHash: string; control: { expected: string; observed: string; identical: boolean }; regions: { region: string; pathSamples: number; minimumPercent: number; status: string }[] }[];
          };
          const result = proof.results.find(item => item.tier === receipt.tier);
          const expectedCodeHash = createHash('sha256').update(readFileSync('tools/qa/accept/l10-region-reach-r10.ts')).digest('hex');
          const fresh = proof.sourceHash === receipt.sourceHash && proof.observerHash === receipt.observerHash && proof.codeHash === expectedCodeHash && result?.sourceHash === receipt.sourceHash && result.observerHash === receipt.observerHash && result.control.expected === receipt.nativeStateHash && result.control.observed === receipt.nativeStateHash && result.control.identical;
          if (fresh) for (const region of result.regions) add('L10-04', `${region.region} bounded-path reachability`, { pathSamples: region.pathSamples, minimumPercent: region.minimumPercent }, '≥90%; read-only canonical-state control identical', region.pathSamples > 0 ? region.minimumPercent >= 90 : undefined, proofPath);
        }
      }
      add('L10-10', 'actual eligible charge ticks and increments', observation.charge, '3600 eligible ticks; 3600 increments; no invalid increment', observation.charge.maximum === 3600 ? observation.charge.eligibleTicks === 3600 && observation.charge.incrementTicks === 3600 && observation.charge.invalidIncrements === 0 : undefined);
      add('L10-13', 'release transaction observed prerequisites', observation.release, 'charge3600 + installed + Mega dead + player at console', observation.release ? observation.release.charge === 3600 && observation.release.installed && observation.release.dead && observation.release.distance <= 2.5 : undefined);
      const front = state.cureFront;
      add('L10-14', 'native cure radius speed', front ? { elapsed: front.elapsed, radius: front.radius } : null, '10 m/s', front && front.elapsed > 0 ? Math.abs(front.radius / (front.elapsed / 60) - 10) < 1e-6 : undefined);
      number('L10-14', 'playable epilogue counter duration', state.counters['epilogue-ticks'] ? state.counters['epilogue-ticks'] / 60 : null, 120, 180);
      break;
    }
  }
  return checks;
}

/** Only these rows have all clauses covered by the current native checks at both qualities. */
export const completeNativeRows = new Map<string, { clause: string; policy: string; level?: string }[]>([
  ['L10-14', ['continuous physical epilogue control and final camera pullback', 'actual cure front mortality immunity and all species fixture', 'reviewed actual mist title credits and menu sequence'].map(clause => ({ clause, policy: 'physical-epilogue' }))],
  ['G-10', [{ clause: 'moving approach collection for every pickup class', policy: 'controlled-fixture', level: 'L6' }]],
  ['G-11', [...Array.from({ length: 10 }, (_, i) => ({ clause: 'duplicate pickup transactions since the last restore', policy: 'complete', level: `L${i + 1}` })), { clause: 'pickup remains removed for 120 ticks after transaction', policy: 'controlled-fixture', level: 'L1' }]],
  ['G-12', [{ clause: '35-follower production eligibility and cap', policy: 'controlled-fixture', level: 'L7' }]],
  ['G-24', [{ clause: 'production enemy-bar eligibility at distance/health boundaries', policy: 'controlled-fixture', level: 'L8' }]],
  ['G-16', Array.from({ length: 10 }, (_, i) => ({ clause: 'weapons offered in the ordinary initial racks', policy: 'complete', level: `L${i + 1}` }))],
  ['G-25', Array.from({ length: 10 }, (_, i) => ({ clause: 'physical WASD/mouse full-level browser console', policy: 'real-input-webgl2', level: `L${i + 1}` }))],
  ['L1-01', ['native mission graph completion', 'mission deadline and initial weapons'].map(clause => ({ clause, policy: 'complete' }))],
  ['L1-02', ['initial civilian entity census', 'morning infected/combat census'].map(clause => ({ clause, policy: 'complete' }))], // Exact-clause review supplies the sixty-second facing observation.
  ['L1-03', []], // Entire criterion is an objective visual sequence; exact-clause review is mandatory.
  ['L1-04', []], // Entire criterion requires an exact-clause visual comparison with PROD in both qualities.
  ['L1-06', [{ clause: 'observed front-door crossing order and departure headings', policy: 'controlled-fixture' }]],
  ['L1-07', ['remote idle initial five infected', 'remote idle living infected at120s', 'remote idle living infected at240s', 'remote idle every additional turn follows a bite', 'remote observer remains undisturbed'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L1-08', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    ...['stationary first real player attack (phase clock)'].map(clause => ({ clause, policy: 'stationary' })),
  ]],
  ['L1-09', ['production L1 tier run-speed bounds', 'equal-tier spawn share faster than4.5m/s'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L1-12', []], // Exact-clause review supplies the physical alley passage and fence pixels.
  ['L1-11', []], // Exact-clause review supplies actual physical motion and same-side fence/wall proof.
  ['L1-10', []], // Exact-clause review supplies the scoped natural first-encounter same-ID warning proof.
  ['L1-13', ['weapon.fists hits to incapacitate native regular', 'weapon.bat hits to incapacitate native regular', 'ordinary first bat acquisition at garage'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L1-15', []], // Exact-clause review supplies physical final entry and actual gate/corgi/live-AI proof.
  ['L1-14', [{ clause: 'admitted garage refuge residents', policy: 'complete' }]], // Exact-clause observation also requires emergence and actual forecourt positions.
  ['L2-01', ['calm combat and alarm/crew clocks', 'initial bench civilian identity census (seat geometry unreviewed)'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L2-02', [{ clause: 'native no-axe completion (rack pixels remain open)', policy: 'controlled-fixture' }]],
  ['L2-03', ['native ride seating and timing', 'native seven-person seated roster and complete exit/control clocks'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L2-04', ['arrival/exit/doors event order', 'door forcing duration', 'nearest living infected before doors open'].map(clause => ({ clause, policy: 'complete' }))],
  ['L2-05', ['prepared trapped civilian identities', 'first release after doors open'].map(clause => ({ clause, policy: 'complete' }))],
  ['L2-06', [
    { clause: 'native admitted ambush source counts and angular separation', policy: 'controlled-fixture' },
    ...['complete', 'stationary'].map(policy => ({ clause: 'maximum admitted ambush identity ledger before retry thinning', policy })),
  ]],
  ['L2-07', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    ...['stationary first real player attack (phase clock)'].map(clause => ({ clause, policy: 'stationary' })),
  ]],
  ['L2-09', ['mortal aggressive axe lesson death', 'uninterrupted protected aggressive live census at10/90s'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L2-10', ['axe single/roundhouse target selection', 'axe measured roundhouse displacement'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L2-11', ['native ordinary-route bridge-start population and route singles', 'native axe-route bridge-start escape-area census, groups, chase share and scattered singles'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L2-13', [{ clause: 'native visible runner-to-calm pedestrian propagation', policy: 'controlled-fixture' }]],
  ['L2-08', ['idle snowball live infected census', 'idle firefighter combat and turns', 'idle every firefighter has no story immunity after doors open'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L2-12', ['competent bridge player attack rate', 'visible infected encountered per30m of actual bridge route'].map(clause => ({ clause, policy: 'complete' }))],
  ['L3-01', [
    { clause: 'actual handgun pickup clock', policy: 'complete' },
    ...['actual first handgun acquisition clock', 'handgun hits versus40 HP specimen'].map(clause => ({ clause, policy: 'controlled-fixture' })),
  ]], // Exact-clause review additionally supplies armory location and actual600-shot/full-HUD proof.
  ['L2-14', [{ clause: 'maximum admitted Elm cluster identities before retry thinning', policy: 'complete' }]],
  ['L2-15', [{ clause: 'prepared checkpoint officers', policy: 'complete' }, { clause: 'prepared checkpoint civilians', policy: 'complete' }, { clause: 'gate close and post-close infected crossings', policy: 'controlled-fixture' }]],
  ['L3-05', []], // Exact-clause review covers the actual camera scale and fight framing.
  ['L3-14', [{ clause: 'actual army soldier identities', policy: 'complete' }]], // Exact-clause review supplies buses, vehicles, rest, ring and evacuation.
  ['L3-15', []], // Exact-clause review requires the actual80-infected rendered horde.
  ['L3-03', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    ...['stationary first real player attack (phase clock)'].map(clause => ({ clause, policy: 'stationary' })),
  ]],
  ['L3-04', ['exact first-of fallback boundary and cause', 'idle fallback deadline and officer identity/uniform', 'controlled first-of fallback boundaries'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L3-07', [{ clause: 'mortal segment1 officers land hits and player damage', policy: 'controlled-fixture' }]],
  ['L3-08', ['authored segment populations before admission/death relief', 'median live within30m by traversed segment and concurrent cap'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L3-09', [{ clause: 'native L3 human speed and admitted sprinter fraction', policy: 'controlled-fixture' }]],
  ['L3-10', ['native idle pressure schedule and offscreen source band', 'native idle pressure actual admissions per full ten-second window', 'native pressure queued admissions stop on advance'].map(clause => ({ clause, policy: 'controlled-fixture' }))], // Exact-clause review must cover the remaining progress lines.
  ['L3-11', [
    { clause: 'competent player attack rate on checkpoint route', policy: 'complete' },
    ...['initial authored medkit entities by street', 'mortal newbie time below20percent HP'].map(clause => ({ clause, policy: 'controlled-fixture' })),
  ]],
  ['L4-01', [
    ...['convoy vehicle identities', 'convoy duration'].map(clause => ({ clause, policy: 'complete' })),
    ...['courier control restored after actual convoy stop', 'full passenger bus parks inside the military perimeter'].map(clause => ({ clause, policy: 'controlled-fixture' })),
  ]],
  ['L4-15', [{ clause: 'actual military-wall capsule solidity and bounded isometric camera family', policy: 'controlled-fixture' }]],
  ['L4-14', [{ clause: 'actual cellar-entry live damage and renderer scorch census', policy: 'controlled-fixture' }]],
  ['L4-18', [{ clause: 'reviewed clean living plaza and readable battle courier', policy: 'real-input-webgl2' }]],
  ['L4-16', [
    { clause: 'uninterrupted standing bar interaction with E continuously false', policy: 'controlled-fixture' },
    ...['actual cellar entrant roster', 'decoded low-pass battle audible after barring', 'actual same-basement L5 handover', 'reviewed visible companion in cellar'].map(clause => ({ clause, policy: 'real-input-webgl2' })),
  ]],
  ['L5-02', [{ clause: 'actual opening objective silence allied-fire and moving-vehicle clocks', policy: 'controlled-fixture' }]],
  ['L5-03', [{ clause: 'actual initial infected positions accepted cohorts and all street bands', policy: 'controlled-fixture' }]],
  ['L5-14', [{ clause: 'sun intensity state multiplier at metro/end', policy: 'complete' }, { clause: 'reviewed four exact matched L4 L5 camera pairs', policy: 'controlled-fixture' }]],
  ['L5-13', [{ clause: 'zero-survivor ordinary route and rescued result', policy: 'controlled-fixture' }]],
  ['L5-11', [{ clause: 'reviewed heroine colour in fog and bus hiding-place readability', policy: 'real-input-webgl2' }]],
  ['L5-05', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    { clause: 'stationary first real player attack (phase clock)', policy: 'stationary' },
    { clause: 'competent route visible infected encounters per40m', policy: 'complete' },
  ]],
  ['L5-01', ['authored shotgun start distance and moving approach pickup', 'one close shotgun shell incapacitates60HP regular', 'two close shotgun shells incapacitate300HP Alpha within0.6s'].map(clause => ({ clause, policy: 'controlled-fixture' }))],
  ['L5-04', [{ clause: 'living Alphas have body-clear routes after actual cellar exit', policy: 'controlled-fixture' }]],
  ['L6-01', [...['initial shelter occupant identities', 'initial shelter roster full health'].map(clause => ({ clause, policy: 'complete' })), { clause: 'actual carried shelter identities routines and stowed guns', policy: 'controlled-fixture' }]],
  ['L6-06', [{ clause: 'six alternating entries and all admitted bodies on reachable tracks', policy: 'controlled-fixture' }]],
  ['L6-11', [{ clause: 'ordinary complete and evade-only rescue outcome', policy: 'controlled-fixture' }]],
  ['L6-12', [{ clause: 'result roster accounting', policy: 'complete' }, { clause: 'drawn and solid Northgate caption framing and exact counts', policy: 'controlled-fixture' }]],
  ['L6-14', [{ clause: 'measured underground contrast and brightest infected eyes matrix', policy: 'controlled-fixture' }]],
  ['L6-02', [{ clause: 'actual headlamp approach persistence head-following beam and no new weapons', policy: 'controlled-fixture' }]],
  ['L6-03', [{ clause: 'actual first breach bang clock and six shelter-floor arrivals', policy: 'controlled-fixture' }]],
  ['L6-04', [
    ...['second breach delay', 'second-wave admitted identities', 'second-wave source accesses'].map(clause => ({ clause, policy: 'complete' })),
    { clause: 'actual second breach arrivals power and abandon condition', policy: 'controlled-fixture' },
  ]],
  ['L4-06', ['first physical breach level clock', 'living infected at first breach', 'sustained plaza living minimum after +45 s'].map(clause => ({ clause, policy: 'stationary' }))],
  ['L4-08', [{ clause: 'actual Alpha admission directions and line hits', policy: 'controlled-fixture' }]],
  ['L4-03', [{ clause: 'actual MG pickup klaxon and attack start share simulation tick', policy: 'real-input-webgl2' }]],
  ['L4-02', [{ clause: 'pre-pickup reception census routines separation and reviewed calm visuals', policy: 'real-input-webgl2' }]],
  ['L4-04', ['complete', 'stationary'].flatMap(policy => ['soldiers at turn', 'civilian census at turn excluding soldiers', 'actual armed civilian share at turn', 'every war tick observed from turn through line break', 'war living infected plus reserved slots and pending turns', 'war living character identity census'].map(clause => ({ clause, policy })))],
  ['L4-09', [
    ...['line1 actual beat after first turn', 'nests actual beat after first turn', 'armor actual beat after first turn', 'fallback after third line break'].map(clause => ({ clause, policy: 'complete' })),
    { clause: 'native camera beat duration and half-second input gate', policy: 'controlled-fixture' },
  ]],
  ['L6-05', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    ...['l6.breach1', 'l6.breach2'].map(name => ({ clause: `stationary first attack after ${name}`, policy: 'stationary' })),
  ]],
  ['L6-07', ['ordinary retreat route completion', 'retreat player/group windups per minute', 'actual HP lost during retreat', 'retreat concurrent infected cap'].map(clause => ({ clause, policy: 'complete' }))],
  ['L7-01', [
    { clause: 'native launcher horizontal distance from night-exit checkpoint', policy: 'complete' },
    ...['physical launcher approach pickup and first rocket frame gate', 'reviewed actual launcher first-rocket captures'].map(clause => ({ clause, policy: 'physical-pickup' })),
  ]],
  ['L7-05', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    { clause: 'stationary first real player attack (phase clock)', policy: 'stationary' },
  ]],
  ['L7-08', ['initial admitted final horde census with canonical control','physical rocket-cleared disc used by living carried human','reviewed physical corridor strips'].map(clause=>({clause,policy:'physical-corridor'}))],
  ['L10-08', ['physical five-region road framing matrix', 'production road and finale maximal zoom clamp', 'reviewed night road verges clothing and natural ground-slam telegraph'].map(clause => ({ clause, policy: 'physical-framing' }))],
  ['L7-06', ['physical Harbor and Lakeshore corridor routes with current bounds sweep', 'screenshot-only wrong-turn and route-clarity review'].map(clause => ({ clause, policy: 'physical-routes' }))],
  ['L7-11', ['continuous physical departure duration and bus displacement', 'reviewed complete cinematic visual strip'].map(clause => ({ clause, policy: 'physical-departure' }))],
  ['L7-12', ['physical rocket and horde player contrast matrix', 'reviewed ruined-city and Alpha motion frames'].map(clause => ({ clause, policy: 'physical-readability' }))],
  ['L7-03', ['physical rocket cadence and overlapping flight','clicked empty-ground impact','one physical rocket kills24-body three-metre cohort','three-metre movement gap in controlled cohort','reviewed night rockets blood and pointblank impact peak','physical rocket first-hit detonation','physical rocket catalog max-range detonation'].map(clause=>({clause,policy:'real-input-webgl2'}))],
  ['L7-04', ['actual resident and later regular admissions', 'actual resident and later Alpha admissions', 'concurrent cap'].map(clause => ({ clause, policy: 'complete' }))],
  ['L6-13', [{ clause: 'ordinary fists-only route completion', policy: 'controlled-fixture' }]],
  ['L6-10', [{ clause: 'native fixed-gate/platform marker trajectory', policy: 'controlled-fixture' }]],
  ['L6-08', [{ clause: 'observed human follower pace versus phase group median', policy: 'complete' }, { clause: 'all original follower settled speed and per-ID visible bars', policy: 'controlled-fixture' }]],
  ['L6-09', [{ clause: 'actual gates width collision endurance refusal and persistent prompt', policy: 'controlled-fixture' }]],
  ['L9-06', ['six authored physical routes remain driveable','three physical offroad stall and reverse recoveries','reviewed world arrow absence and exact durability HUD'].map(clause=>({clause,policy:'physical-wedge'}))],
  ['L9-09', ['actual terrain GLB shared-edge heights',...['road','countryside','dry-shortcut'].map(r=>`${r} physical streaming residency and continuous input`)].map(clause=>({clause,policy:'streaming-physical'}))],
  ['L9-01', [{clause:'physical carried start control and reviewed occupants',policy:'real-input-webgl2'}]],
  ['L9-08', [{ clause: 'actual crossing transaction into L10', policy: 'controlled-fixture' }]],
  ['L9-02', [{ clause: 'actual admitted route group census and driven detour clearance', policy: 'controlled-physical' }, ...['road', 'countryside', 'dry-shortcut'].map(route => ({ clause: `${route} actual WASD detour around every group`, policy: 'real-input-detour' }))]],
  ['L9-04', [
    ...['shortcut durability billing per unique contact onset', 'stopped-surround attacks deal10 damage after at least0.6s windup'].map(clause => ({ clause, policy: 'controlled-fixture' })),
    ...['physical matched safe route retains more durability than shortcut', 'physical route contact and attack billing'].map(clause => ({ clause, policy: 'real-input-webgl2' })),
  ]],
  ['L10-10', [
    { clause: 'actual eligible charge ticks and increments', policy: 'complete' },
    ...['charge inside/outside/dead/resume boundary and pause instruction', 'minigun rounds and heat per full-speed second', 'minigun overheat lock', 'minigun unlock threshold'].map(clause => ({ clause, policy: 'controlled-fixture' })),
  ]],
  ['L10-13', [{ clause: 'release transaction observed prerequisites', policy: 'complete' }, { clause: 'release predicate missing-prerequisite matrix', policy: 'controlled-fixture' }]],
  ['L10-02', ['actual Mega introduction time', 'Mega distance on introduction', 'actual Mega roar and impact introduction events', 'Mega introduction actual body-clear route'].map(clause => ({ clause, policy: 'complete' }))],
  ['L10-03', [
    { clause: 'same-tick regional count and species composition', policy: 'complete' },
    { clause: 'residential dogs follow actual handgun pickup', policy: 'complete' },
    ...['residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'destroyed-corridor', 'dispersal-complex'].map(region => ({ clause: `${region} normal local concurrent peak bound`, policy: 'complete' })),
    ...['residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'destroyed-corridor'].flatMap(region => [
      { clause: `${region} concurrent dog peak`, policy: 'complete' },
      ...(['industrial-area', 'military-zone', 'research-campus', 'destroyed-corridor'].includes(region) ? [{ clause: `${region} concurrent Alpha peak`, policy: 'complete' }] : []),
    ]),
    ...['military-breach', 'military-column', 'military-exit', 'corridor-line', 'corridor-breach', 'corridor-exit'].map(group => ({ clause: `${group} regular group size`, policy: 'complete' })),
  ]],
  ['L10-04', [
    ...['crash-outskirts', 'residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'destroyed-corridor', 'dispersal-complex'].map(region => ({ clause: `${region} bounded-path reachability`, policy: 'complete' })),
    ...['crash-outskirts', 'residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'destroyed-corridor', 'dispersal-complex'].map(region => ({ clause: `${region} player windups per minute`, policy: 'complete' })),
  ]],
  ['L10-11', [
    ...['competent hold player windups per minute', 'competent hold bounded-path reachable share'].map(clause => ({ clause, policy: 'complete' })),
    ...['full active assault hold duration', 'capped active infected peak', 'hold player windups per minute', 'hold bounded-path reachable share', 'Mega arena arrival after charge activation', 'persistent Mega identity without scheduled replacement or teleport'].map(clause => ({ clause, policy: 'stationary' })),
  ]],
  ['L10-05', ['all four named checkpoint pickup and snapshot transactions', 'inventory changes alone spawn zero enemies at every weapon approach'].map(clause => ({ clause, policy: 'complete' }))],
  ['L10-07', [
    ...['observed ordinary cruise ratio to nominal player run', 'continuous same-ID pursuit without LOS or teleport', 'actual paired roar/impact intervals'].map(clause => ({ clause, policy: 'complete' })),
    ...['actual centered pulsing band ring without Mega pin', 'actual paired audio gains increase at closer distance'].map(clause => ({ clause, policy: 'real-input-webgl2' })),
  ]],
  ['L10-06', [
    ...['native dog speed ratio', 'actual dog hit damage/reach', 'actual dog telegraph duration', 'dog cooldown between hit and next windup'].map(clause => ({ clause, policy: 'controlled-fixture' })),
    ...[.5, 1.5].map(zoom => ({ clause: `reviewed living infected dog distinct from corgi at zoom${zoom}`, policy: 'real-input-webgl2' })),
  ]],
  ['L10-09', [
    ...['actual cure grant preserves both weapon racks', 'canister-only controlled movement trajectories'].map(clause => ({ clause, policy: 'complete' })),
    { clause: 'reviewed airborne research subtitles and backpack canister', policy: 'real-input-webgl2' },
    { clause: 'carried canister restored by actual checkpoint death', policy: 'checkpoint-death-fixture' },
  ]],
  ['L10-01', ['first-minute regular infected peak', 'first-minute dog peak', 'first-minute Alpha peak', 'R1 concurrent regular peak', ...['crash-singletons', 'crash-road-pair', 'crash-bend', 'crash-pair'].map(group => `${group} regular group size`)].map(clause => ({ clause, policy: 'complete' }))],
  ['L10-15', ['cure-crash', 'cure-residential', 'cure-industrial', 'cure-military', 'cure-research-entry', 'cure-research', 'cure-corridor', 'cure-complex', 'cure-disperse-ready'].flatMap(checkpoint => [
    { clause: `mortal regional checkpoint ${checkpoint} (cure/boss comparison still partial)`, policy: 'checkpoint-death-fixture' },
    { clause: `cure and boss HP/death snapshot at ${checkpoint}`, policy: 'checkpoint-death-fixture' },
  ])],
  ['L7-10', [
    { clause: 'every living roster identity boarded', policy: 'complete' },
    ...['actual passenger door-entry spacing', 'living infected remaining when boarding has finished', 'offscreen stalled boarding recovery after20s'].map(clause => ({ clause, policy: 'controlled-fixture' })),
  ]],
  ['L8-04', [...['breach active-sim clock','distinct tunnel outlets','actual first packet per tunnel outlet','first ordinary visible actor outlet start window','actual tunnel outlet separation'].map(clause=>({clause,policy:'complete'})),...[0,1,2,3].map(n=>({clause:`tunnel${n} physical timed emergence and reviewed strip`,policy:'physical-breach'}))]],
  ['L8-03', [{clause:'actual calm local census and purposeful routines',policy:'calm-population'},{clause:'outside wall pursuit cannot cross or damage occupants',policy:'calm-population'},{clause:'reviewed physical calm activity clips',policy:'real-input-calm'}]],
  ['L8-05', ['actual admitted Alphas over observed route','concurrent cap','unprotected local-threat victim class coverage','all five same-ID species convert after actual bites'].map(clause=>({clause,policy:'complete'}))],
  ['L8-10', ['production L8 to L9 handover first frame within6s', 'actual physical departure APC identity durability and seats retained'].map(clause => ({ clause, policy: 'production-handover' }))],
  ['L8-09', [
    { clause: 'every living native group identity seated', policy: 'complete' },
    ...['actual complete passenger identity boarding and wait gate', 'every outside waiting healthy survivor has production radar guidance', 'actual departure APC is unarmed'].map(clause => ({ clause, policy: 'boarding-sweep' })),
  ]],
  ['L8-08', [...['lion','gorilla','elephant','zebra','flamingo'].map(species=>`reviewed original ${species} conversion and moving paired views`), 'reviewed physical canopy night readability','reviewed physical postbreach-canopy night readability'].map(clause=>({clause,policy:'physical-animal'}))],
  ['L8-07', ['native escape marker remains fixed at APC','two independent body-clear enclosure exits at2.5m width'].map(clause=>({clause,policy:'complete'}))],
  ['L8-06', [
    ...['complete', 'stationary'].flatMap(policy => ['combat hard rule on actual player windups', 'real player/group windups per minute', 'minimum bounded-path reachable share within30m (path≤2.5×direct)'].map(clause => ({ clause, policy }))),
    { clause: 'stationary first real player attack (phase clock)', policy: 'stationary' },
  ]],
  ['L7-07', ['corridor marker identity changes', 'every corridor HUD counter matches independent live roster census'].map(clause => ({ clause, policy: 'complete' }))],
  ['L8-01', [
    ...['new weapon pickup census', 'observed route weapon pickup transactions'].map(clause => ({ clause, policy: 'complete' })),
    { clause: 'actual carried L7 roster full health racks and selected weapon', policy: 'real-input-webgl2' },
  ]],
  ['L8-02', [
    { clause: 'native calm marker and infected attack event state (HUD text requires browser)', policy: 'complete' },
    { clause: 'carried real-input 60-second opening objective and marker audit', policy: 'real-input-webgl2' },
  ]],
  ['L9-03', ['road', 'countryside', 'dry-shortcut'].map(route => ({ clause: `${route} full driving camera visibility`, policy: 'real-input-webgl2' }))],
  ['L9-05', [{ clause: 'physical zero-HP speed smoke and continued driving', policy: 'controlled-physical' }]],
  ['L9-07', [
    ...['canonical', 'zero'].map(mode => ({ clause: `${mode} crash once and wreck objective ordering`, policy: 'controlled-fixture' })),
    { clause: 'physical full and zero whole-body crash and objective ordering', policy: 'controlled-physical' },
  ]],
  ['L7-02', ['selectable story weapons after native launcher pickup', 'actual L6 carried identities full-health formation and arsenal'].map(clause => ({ clause, policy: 'complete' }))],
]);
