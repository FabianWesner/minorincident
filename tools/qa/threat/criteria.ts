import type { LevelReceipt } from '../threat-audit';

export interface CriterionRow { id: string; passive: string; skilled: string; expected: string; verdict: 'PASS' | 'FAIL' | 'NOT MEASURED' | 'NEEDS CLARIFICATION'; }
/** Absolute acceptance checks; unresolved reference clocks stay explicit. */
export function focusedCriteria(levels: LevelReceipt[]): CriterionRow[] {
  const rows: CriterionRow[] = [];
  const add = (id: string, passive: string, expected: string, pass: boolean | undefined, skilled = '—') => rows.push({ id, passive, skilled, expected, verdict: pass === undefined ? 'NOT MEASURED' : pass ? 'PASS' : 'FAIL' });
  const l3 = levels.find(r => r.level === 'L3'), l4 = levels.find(r => r.level === 'L4');
  const waves = l3?.passiveObservation?.waves.filter(w => w.key.startsWith('station-'));
  const completedWaves = l3?.observation?.waves.filter(w => w.key.startsWith('station-'));
  add('L3-02 cohorts', waves?.map(w => `${w.spawned}/${w.expected}`).join(', ') ?? 'not measured', '15/30/50 actual members on low tier', waves && waves.length === 3 && waves.every(w => w.spawned === w.expected) && completedWaves?.length === 3 && completedWaves.every(w => w.spawned === w.expected), completedWaves?.map(w => `${w.spawned}/${w.expected}`).join(', ') ?? 'not measured');
  add('L3-02 stream', waves?.map(w => `${w.scheduledStreamSeconds.toFixed(2)} s scheduled; ${w.spawnedWithinEighteenSeconds} admitted`).join('; ') ?? 'not measured', 'every cohort admitted within its ≤18 s stream', waves && waves.length === 3 && waves.every(w => w.scheduledStreamSeconds <= 18 && w.spawnedWithinEighteenSeconds === w.expected));
  const opening = waves?.find(w => w.key === 'station-0');
  add('L3-02 alarm frame', opening ? `${opening.visibleWithinTwoSeconds}/${opening.expected}` : 'not measured', '≥25% of opening wave on screen within 2 s', opening && opening.visibleWithinTwoSeconds >= Math.ceil(opening.expected! / 4));
  for (const [id, level, step] of [['L3-03 first attack', l3, 'defend'], ['L4-07 first attack', l4, 'hold']] as const) {
    const row = level?.passiveObservation?.phases.find(p => p.key === `step/${step}`);
    add(id, row?.firstAttackSeconds === null || !row ? 'not measured' : `${row.firstAttackSeconds.toFixed(2)} s`, '≤10 s', row && row.firstAttackSeconds !== null && row.firstAttackSeconds <= 10);
  }
  const squad = l3?.observation?.l3Squad;
  const army = l3?.l3Army;
  add('L3-06 squad counts/losses', '—', '3–4 at fallback; ≤2 at army (seeds 1–3: ≥2 valid, ≥2 of them ≤2); every loss a bite/kill/separation', squad && squad.initial !== null && squad.initial >= 3 && squad.initial <= 4 && squad.losses.every(q => ['bite', 'kill', 'separated'].includes(q.cause)) ? army?.pass : squad ? false : undefined, squad ? `${squad.initial} → army ${army ? army.seeds.map(q => `s${q.seed}:${q.valid ? q.army : 'invalid'}`).join('/') : 'not measured'} (${army?.within ?? 0}/${army?.measured ?? 0} ≤2); ${squad.losses.map(q => q.cause).join(', ')}` : 'not measured');
  const route = l3?.observation?.phases.find(p => p.key === 'step/checkpoint');
  add('L3-11 native competent rate', '—', '3–25 player attacks/min', route && route.attacksPerMinute >= 3 && route.attacksPerMinute <= 25, route ? `${route.attacksPerMinute.toFixed(2)}/min; ${l3!.run?.damageTaken} damage; ${l3!.run?.deaths} deaths` : 'not measured');
  const hold = l4?.highHold;
  add('L4-05 directions/groups', hold ? `${hold.arrivalEdges.length} edges; ≥60°: ${hold.threeDirectionsAtLeast60Degrees}; max group ${hold.maxGroupAtOneSourcePerTick}` : 'not measured', '≥3 edges ≥60° apart; groups ≤5 at each source', hold && hold.arrivalEdges.length >= 3 && hold.threeDirectionsAtLeast60Degrees && hold.maxGroupAtOneSourcePerTick <= 5);
  add('L4-06 first breach', hold ? `${hold.firstBreachLevelSeconds?.toFixed(2)} s level / +${hold.firstBreachAfterTurnSeconds?.toFixed(2)} s alarm; ${hold.aliveAtFirstBreach} alive` : 'not measured', 'level clock 30–60 s; ≥60 alive at first breach', hold && hold.firstBreachLevelSeconds !== null && hold.firstBreachLevelSeconds >= 30 && hold.firstBreachLevelSeconds <= 60 && hold.aliveAtFirstBreach !== null && hold.aliveAtFirstBreach >= 60);
  add('L4-06 sustained horde', hold ? `minimum ${hold.minPlazaAliveAfter45Seconds}; ${hold.samplesAfter45Seconds} observations; line break ${hold.lineBreakAfterTurnSeconds?.toFixed(2)} s` : 'not measured', '≥40 living in authored plaza from alarm +45 s through line break', hold && hold.holdComplete && hold.samplesAfter45Seconds > 0 && hold.minPlazaAliveAfter45Seconds !== null && hold.minPlazaAliveAfter45Seconds >= 40);
  return rows;
}
