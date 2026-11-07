import type { AuditReceipt } from '../threat-audit';
import { threatSteps } from './phases';
import { focusedCriteria } from './criteria';
import type { RunnerLevel } from '../../sim-runner/levels';
import { followerPaceChecks, followerSampleMinimum, followerWaitFlags } from './observer';

const n = (value: number | null) => value === null ? '—' : value.toFixed(2);
const escape = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
export function renderReport(audit: AuditReceipt, baseline = false): string {
  let text = `# Threat calibration\n\nRuntime main: \`${audit.mainRevision}\`; harness base: \`${audit.revision}\`. Runtime source matches main: **${audit.sourceMatchesMain}**. Seed 1 (L5/L7 follower pace: seeds 1–3), skilled and passive native routes, **low** population set before mission preparation. At most ${audit.workers} simulation workers across independent levels or extra follower seeds; ${n(audit.seconds)} seconds, budget 600 seconds. Result: **${audit.flags.length} acceptance fail flags**.\n\n`;
  text += baseline ? '[Raw baseline receipts](baseline.json). ' : '[Raw audit receipts](audit.json). ';
  if (audit.passivity) text += `Independent runs without the observer produced identical final native state hashes for **${audit.passivity.levels}/${audit.passivity.levels} levels** (${n(audit.passivity.seconds)} seconds); ${baseline ? '[passivity proof](passivity.json)' : 'see `passivity.json`'}. `;
  text = text.trimEnd() + '\n\n';
  text += '## Measurement contract\n\nEvery active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.\n\n';
  text += 'Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.\n\n';
  text += 'Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median (L5/L7: the same follower/phase must fail in at least two valid seeds out of seeds 1–3); the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.\n\n';
  text += 'Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. The skilled route also gates zero windups in every inventoried combat phase, L2 bridge ≥2/min, L5 search ≥3/min, L10 hold ≥8/min and L6 mortal damage ≥30 HP. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing.\n\n';
  text += '## Run coverage\n\n| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |\n|---|---|---:|---:|---:|---:|---:|\n';
  for (const level of audit.levels) text += `| ${level.level} | ${level.run?.outcome ?? 'error'} | ${n(level.run?.time ?? null)} | ${level.passiveRun?.outcome ?? 'error'} / ${level.passiveRun?.furthestObjective ?? '—'} | ${n(level.passiveRun?.time ?? null)} | ${level.passiveObservation?.phases.length ?? 0} | ${level.passiveObservation?.waves.length ?? 0} | ${n(level.wallSeconds)} | ${level.passiveFlags.length} |\n`;
  text += '\n## Acceptance criteria matrix\n\n| Criterion | Passive measured | Skilled measured | Expected | Verdict |\n|---|---:|---:|---|---|\n';
  const specs: Record<string, { level: RunnerLevel; step: string; floor: number; ceiling?: number; metric: 'attacksPerMinute' | 'totalAttacks' | 'reachability'; mode: 'passive' | 'skilled' }> = {
    'L1-08': { level: 'L1', step: 'phase/spread', floor: 3, metric: 'attacksPerMinute', mode: 'passive' },
    'L2-07': { level: 'L2', step: 'phase/collapse', floor: 4, metric: 'attacksPerMinute', mode: 'passive' },
    'L2-07 reach': { level: 'L2', step: 'phase/collapse', floor: 90, metric: 'reachability', mode: 'passive' },
    'L2-12': { level: 'L2', step: 'bridge', floor: 2, ceiling: 20, metric: 'attacksPerMinute', mode: 'skilled' },
    'L3-03': { level: 'L3', step: 'defend', floor: 4, metric: 'attacksPerMinute', mode: 'passive' },
    'L3-03 reach': { level: 'L3', step: 'defend', floor: 90, metric: 'reachability', mode: 'passive' },
    'L4-07': { level: 'L4', step: 'hold', floor: 6, metric: 'attacksPerMinute', mode: 'passive' },
    'L4-07 reach': { level: 'L4', step: 'hold', floor: 90, metric: 'reachability', mode: 'passive' },
    'L5-05': { level: 'L5', step: 'look', floor: 3, metric: 'totalAttacks', mode: 'passive' },
    'L6-05': { level: 'L6', step: 'stop', floor: 4, metric: 'attacksPerMinute', mode: 'passive' },
    'L6-05 reach': { level: 'L6', step: 'stop', floor: 95, metric: 'reachability', mode: 'passive' },
    'L6-06': { level: 'L6', step: 'retreat', floor: 95, metric: 'reachability', mode: 'passive' },
    'L7-05': { level: 'L7', step: 'corridor', floor: 6, metric: 'totalAttacks', mode: 'passive' },
    'L8-06': { level: 'L8', step: 'escape', floor: 4, metric: 'totalAttacks', mode: 'passive' },
    'L10-11': { level: 'L10', step: 'hold', floor: 8, metric: 'attacksPerMinute', mode: 'passive' },
  };
  for (const [id, spec] of Object.entries(specs)) {
    const level = audit.levels.find(item => item.level === spec.level);
    const key = spec.step.startsWith('phase/') ? spec.step : `step/${spec.step}`;
    const passive = level?.passiveObservation?.phases.find(row => row.key === key);
    const skilled = level?.observation?.phases.find(row => row.key === key);
    const row = spec.mode === 'passive' ? passive : skilled;
    const reachSnapshot = row && row.maxBlockedSeconds > 20 && row.blockedEvidence ? row.blockedEvidence : row?.last;
    const measured = row ? spec.metric === 'attacksPerMinute' ? n(row.attacksPerMinute) : spec.metric === 'totalAttacks' ? `${n(row.attacksPerMinute)} + ${n(row.groupAttacksPerMinute)} group` : reachSnapshot ? n(reachSnapshot.reachable * 100 / Math.max(1, reachSnapshot.alive)) + '%' : '—' : 'not measured';
    const val = row ? spec.metric === 'attacksPerMinute' ? row.attacksPerMinute : spec.metric === 'totalAttacks' ? row.attacksPerMinute + row.groupAttacksPerMinute : reachSnapshot ? reachSnapshot.reachable * 100 / Math.max(1, reachSnapshot.alive) : null : null;
    const pass = val !== null && val >= spec.floor && (spec.ceiling === undefined || val <= spec.ceiling);
    const complete = (spec.level === 'L3' || spec.level === 'L4') && (spec.mode === 'passive' ? level?.passiveRun : level?.run)?.objectiveTimeline.some(o => o.id === spec.step);
    const verdict = val === null ? 'NOT MEASURED' : spec.metric === 'attacksPerMinute' && row!.seconds < 20 && !complete ? 'SHORT WINDOW' : pass ? 'PASS' : 'FAIL';
    const measuredCell = spec.metric === 'attacksPerMinute' && row && row.seconds < 20 ? `${measured} (${n(row.seconds)} s)` : measured;
    text += `| ${id} | ${spec.mode === 'passive' ? measuredCell : '—'} | ${spec.mode === 'skilled' ? measuredCell : '—'} | ${spec.metric === 'reachability' ? `≥ ${spec.floor}%` : `≥ ${spec.floor}${spec.ceiling ? ` and ≤ ${spec.ceiling}` : ''}/min`} | ${verdict} |\n`;
  }
  const followerFindings = new Map<number, number>();
  for (const level of audit.levels) for (const row of level.passiveFollowerPace ? [] : level.passiveObservation?.phases ?? []) if (row.followerMedian && row.followerMedian > 0)
    for (const follower of row.followerSpeeds) if (follower.samples >= followerSampleMinimum && follower.median < .95 * row.followerMedian) followerFindings.set(follower.id, Math.min(followerFindings.get(follower.id) ?? 1, follower.median / row.followerMedian));
  const routePace: string[] = [], routeWait: string[] = [];
  let waitNotProven = false;
  for (const level of audit.levels) {
    const check = followerPaceChecks[level.level], row = level.observation?.phases.find(p => p.key === check?.phase);
    for (const [policy, pace] of [['complete', level.followerPace], ['passive', level.passiveFollowerPace]] as const) for (const vote of pace?.rows ?? []) {
      routePace.push(`${level.level}/${policy}/${vote.phase}/${vote.id}: ${vote.seeds.map(s => `s${s.seed}=${s.valid ? (s.ratio! * 100).toFixed(1) + '%' : 'unmeasured'}(${s.samples})`).join(', ')}; ${vote.failures}/${vote.measured} fail`);
      if (vote.pass === false) followerFindings.set(vote.id, Math.min(...vote.seeds.filter(s => s.valid).map(s => s.ratio!)));
    }
    if (!check) continue;
    const wait = level.observation?.followerWait;
    routeWait.push(`${level.level}: ${wait?.upperBoundPercent == null ? 'unmeasured' : n(wait.upperBoundPercent) + '%'}`);
    waitNotProven ||= followerWaitFlags(wait).length > 0;
    for (const id of check.ids) {
      const follower = row?.followerSpeeds.find(f => f.id === id), ratio = follower && row?.followerMedian ? follower.median / row.followerMedian : null;
      routePace.push(`${level.level}/${id}: ${ratio === null ? 'unmeasured' : (ratio * 100).toFixed(1) + '%'} (${follower?.samples ?? 0} samples)`);
      if (!level.followerPace && ratio !== null && follower!.samples >= followerSampleMinimum && ratio < .95) followerFindings.set(id, ratio);
    }
  }
  const missingPace = audit.flags.some(flag => flag.includes('FOLLOWER_PACE_UNOBSERVED'));
  text += `| G-13 | ${[...followerFindings].map(([id, ratio]) => `${id} (${(ratio * 100).toFixed(0)}% of group median)`).join(', ') || 'none'} | ${routePace.join('; ') || '—'}; wait upper bounds: ${routeWait.join(', ') || '—'} | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | ${followerFindings.size || missingPace || waitNotProven ? 'FAIL' : 'PASS'} |\n`;
  for (const row of focusedCriteria(audit.levels)) text += `| ${row.id} | ${row.passive} | ${row.skilled} | ${row.expected} | ${row.verdict} |\n`;
  text += '| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |\n';
  const l8 = audit.levels.find(item => item.level === 'L8'), breach = l8?.passiveObservation?.waves.find(wave => wave.key === 'tunnel-breach');
  const outletCounts = breach?.outletCohorts?.map(row => row.spawned) ?? [];
  const breachLedger = breach ? `${breach.spawned}/${breach.expected ?? '—'} across ${outletCounts.length} outlets [${outletCounts.join(', ')}]` : 'not measured';
  const breachLedgerPass = !!breach && !breach.flags.some(flag => flag.startsWith('BREACH_'));
  text += `| L8-04 | ${breachLedger} | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | ${breachLedgerPass ? 'LEDGER PASS; visual pending' : 'FAIL'} |\n`;
  text += '| G-22 | See announced-wave table below | Informational | first attack ≤ 20 s; several reachable infected at start | See wave flags |\n';
  text += '| L9-03 | Not measured by this harness | Not measured | ≥ 1 group/wanderer in camera frame per 60 s, each route | NOT TESTED (harness gap) |\n';
  for (const level of audit.levels) {
    text += `\n## ${level.level}\n\nThreat steps explicitly selected from the loaded mission definition:\n\n`;
    const entries = Object.entries(threatSteps[level.level]);
    text += entries.length ? entries.map(([id, reason]) => `- \`${id}\` — ${level.definitions.find(step => step.id === id)?.text ?? 'MISSING DEFINITION'} (${reason}).`).join('\n') + '\n' : '- None; roadside infected are still measured.\n';
    text += '\n| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |\n|---|---|---:|---:|---:|---:|---|---|\n';
    for (const row of level.passiveObservation?.phases ?? []) {
      const skilled = level.observation?.phases.find(other => other.key === row.key);
      const stepId = row.key.startsWith('step/') ? row.key.slice(5) : row.key.startsWith('phase/') ? row.key.slice(6) : '';
      const criterionRef = (threatSteps[level.level][stepId] ?? '').match(/L\d+-\d+/)?.[0];
      const criterion = row.key === 'step/escape' && level.level === 'L1' ? '—' : criterionRef ?? (row.key === 'phase/spread' && level.level === 'L1' ? 'L1-08' : row.key === 'phase/collapse' && level.level === 'L2' ? 'L2-07' : row.key === 'phase/escape' && level.level === 'L2' ? 'L2-12' : '—');
      const visibleFlags = level.passiveFollowerPace ? [...row.flags.filter(flag => !flag.startsWith('SLOW_FOLLOWER:')), ...level.passiveFollowerPace.flags.filter(flag => flag.startsWith(row.key + ':')).map(flag => flag.slice(row.key.length + 1))] : row.flags;
      const passiveReach = row.maxBlockedSeconds > 20 && row.blockedEvidence ? `worst ${row.blockedEvidence.reachable}/${row.blockedEvidence.alive}; last ${row.last?.reachable}/${row.last?.alive}` : row.last ? `${row.last.reachable}/${row.last.alive}` : '—';
      text += `| ${escape(row.key + ' — ' + row.label)} | ${criterion} | ${n(row.attacksPerMinute)} player + ${n(row.groupAttacksPerMinute)} group/min; ${n(row.firstAttackSeconds)} s | ${skilled ? `${n(skilled.attacksPerMinute)} player + ${n(skilled.groupAttacksPerMinute)} group/min; ${n(skilled.firstAttackSeconds)} s` : '—'} | ${passiveReach} | ${skilled?.last ? `${skilled.last.reachable}/${skilled.last.alive}` : '—'} | ${row.last ? `(${n(row.last.playerX)}, ${n(row.last.playerZ)})` : '—'} | ${visibleFlags.join(', ') || '—'} |\n`;
    }
    text += '\n| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |\n|---|---|---:|---:|---:|---:|---|---:|---|\n';
    for (const wave of level.passiveObservation?.waves ?? []) text += `| ${wave.key} | ${wave.source} | ${n(wave.startSeconds)} | ${n(wave.observedSeconds)} | ${wave.expected ?? '—'} | ${wave.spawned} | ${wave.outletCohorts?.map(row => row.spawned).join(', ') ?? '—'} | ${n(wave.firstAttackSeconds)} | ${wave.flags.join(', ') || '—'} |\n`;
    if (!level.observation?.waves.length) text += '| None announced during native run | — | — | — | — | — | — | — | — |\n';
    text += '\nUnreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):\n\n';
    const evidence = new Map<string, { rows: string[]; snapshot: NonNullable<NonNullable<LevelObservation>['phases'][number]['last']> }>();
    for (const row of level.observation?.phases ?? []) {
      const snapshot = row.blockedEvidence && row.maxBlockedSeconds > 20 ? row.blockedEvidence : row.last;
      if (!snapshot?.positions.length) continue;
      const key = JSON.stringify(snapshot), saved = evidence.get(key) ?? { rows: [], snapshot };
      saved.rows.push(row.key); evidence.set(key, saved);
    }
    if (!evidence.size) text += '- No unreachable identities in the recorded phase snapshots.\n';
    for (const { rows, snapshot } of evidence.values()) text += `- ${rows.map(row => `\`${row}\``).join(', ')} at ${n(snapshot.tick / 60)} s, ${snapshot.alive - snapshot.reachable}/${snapshot.alive} unreachable: ${snapshot.positions.map(p => `\`${p.identity}\` (${n(p.x)}, ${n(p.z)})`).join('; ')}. Player (${n(snapshot.positions[0].playerX)}, ${n(snapshot.positions[0].playerZ)}).\n`;
  }
  text += `\n## Every fail flag\n\n${audit.flags.length ? audit.flags.map(flag => `- ${flag}`).join('\n') : '- None.'}\n\n`;
  text += '## Flag-to-criterion mapping\n\n| Flag | Acceptance criterion |\n|---|---|\n';
  const criteriaForFlag = (flag: string): string => {
    if (flag.includes('SLOW_FOLLOWER') || flag.includes('FOLLOWER_')) return 'G-13';
    if (flag.startsWith('L3/wave/')) return 'L3-02, G-22';
    if (flag.startsWith('L4/wave/war-0')) return 'L4-06, G-22';
    if (flag.startsWith('L4/wave/breach-')) return 'L4-05, G-22';
    if (flag.startsWith('L8/wave/')) return 'L8-04, L8-06, G-22';
    if (flag.startsWith('L3/step/defend')) return 'L3-03';
    if (flag.startsWith('L4/step/hold')) return flag.includes('REACHABILITY') ? 'L4-07' : 'L4-07';
    if (flag.startsWith('L8/step/escape')) return 'L8-06';
    if (flag.startsWith('L10/step/hold')) return 'L10-11';
    return 'see level-specific threat criterion';
  };
  for (const flag of audit.flags) text += `| ${flag} | ${criteriaForFlag(flag)} |\n`;
  text += '\nAbsolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.\n\n';
  text += '## Defect triage provenance\n\nHistorical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.\n\n';
  text += 'Run `npm run qa:threat` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.\n';
  return text;
}
type LevelObservation = AuditReceipt['levels'][number]['observation'];
