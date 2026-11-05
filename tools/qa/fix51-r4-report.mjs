/** Build the lane's open-item inventory from the authoritative acceptance JSONs. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const root = 'docs/reports/fix51-r4';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const levels = Array.from({length: 10}, (_, i) => `L${i + 1}`);
const reports = Object.fromEntries(levels.map(level => [level, read(`docs/reports/fix51-verify/${level}.json`)]));
const global = read('docs/reports/fix51-verify/global.json');
const scopes = [['Global', global.rows], ...levels.map(level => [level, reports[level].rows])];
const rows = scopes.flatMap(([, rows]) => rows);
assert.equal(rows.length, 169); assert.equal(new Set(rows.map(row => row.id)).size, 169);
assert(levels.every(level => reports[level].sourceHash === global.sourceHash && reports[level].observerHash === global.observerHash));
const state = existsSync(`${root}/lane-state.json`) ? read(`${root}/lane-state.json`) : { result: 'IN PROGRESS', summary: 'Verification is running.', gates: [], remainingLaneActions: [] };
const text = value => String(value ?? '').replace(/\s+/g, ' ').trim().replaceAll('|', '\\|');
const short = (value, limit = 260) => { const s = text(typeof value === 'string' ? value : JSON.stringify(value)); return s.length > limit ? s.slice(0, limit - 1) + '…' : s; };
const count = (rows, status, key = 'status') => rows.filter(row => row[key] === status).length;
const physical = existsSync(`${root}/physical-coverage.json`) ? read(`${root}/physical-coverage.json`) : null;
const perf = existsSync(`${root}/perf-summary.json`) ? read(`${root}/perf-summary.json`) : null;
const physicalNext = row => row.level === 'L5'
 ? 'Repeat exploration with deliberate quiet intervals and log cue eligibility; distinguish the search policy from a survivor/cue defect. Four survivors remained hidden in the first failed search.'
 : row.level === 'L7'
 ? 'Replay the failing escort timeline with per-follower position/path state. Four of eight were nearby and a survivor was 74 m behind; the different-cohort completed rerun is not a closure.'
 : row.level === 'L10' && row.backend === 'webgl2'
 ? 'Trace the console approach, actual collision footprint and interaction radius. Prove an ordinary walk to the release action point; do not advance the objective through debug.'
 : row.level === 'L10'
 ? 'Trace the research-campus approach at x=2245.7,z=−47.1 against the native route and physical collision/path state. The actual driver stopped 225 m from the destination; no full-console qualification.'
 : 'Diagnose the recorded blocking issue and repeat the entire ordinary-input cell without objective skips.';
const next = {
 'G-08': 'Track the L8 APC and its door marker by entity ID. Distinguish physical hull settling from a marker following the courier; correct actual destination drift, then repeat both policies and tiers.',
 'G-13': 'Resolve the listed per-follower pace failures at their actual phase and tier, then measure stationary waiting with one follower more than 10 m behind. Preserve the 0.95 ratio.',
 'G-22': 'Trace each late L4 breach cohort from its own announcement through admission, path and actual player windup; correct approach or targeting delays without reducing quotas, then repeat both tiers.',
 'L3-04': 'Retain the first-of 60 s / 3 turned / 8 inside fallback rule. Diagnose why high-tier inside pressure triggers fallback before any officer naturally turns; rerun the mortal idle ledger at both tiers.',
 'L3-06': 'Correct the high-tier squad tactics so at most two arrive through natural bite, kill or separation losses; retain formation and no-teleport checks. The two formation/regroup trials in this lane were rejected.',
 'L3-07': 'Diagnose officer line of fire and shot availability during S1; qualify at least 60% officer knockdowns and under 100 HP player damage at both tiers. The 50% police damage scale and authored populations stay binding.',
 'L3-08': 'Resolve the S3 density drop using actual admission and route ledgers. The retired-waiting-resident guard trial did not qualify the row and was rejected; retain authored population totals and concurrent caps.',
 'L4-07': 'Apply the authorized first physical breach/gate-opening scope. Prove the unchanged 90% bounded-path target and a legal ground/vault/attack-through-barrier route for every infected after opening; diagnose any remaining geometry trap. First-attack and attack-rate clauses remain unchanged.',
 'L8-06': 'Reproduce the complete route with zero player windups at both tiers, trace admission-to-contact paths and intended victims, and correct the encounter so the competent escape has real attack opportunities. Passive pressure alone cannot close this row.',
};
const lines = [
 '# fix51-r4 — acceptance, performance, and remaining work', '',
 `**${state.result}.** ${state.summary}`, '',
 `Game source SHA-256: \`${global.sourceHash}\`. Observer SHA-256: \`${global.observerHash}\`. The current status table retains historical FAILs until their full criteria and PO findings are closed. Fresh clause failures are shown separately.`, '',
 '## Status counts', '',
 '| Scope | PASS | FAIL | NOT CHECKED | Fresh FAIL rows | P requests |',
 '|---|---:|---:|---:|---:|---:|',
 ...scopes.map(([scope, rows]) => `| ${scope} | ${count(rows, 'PASS')} | ${count(rows, 'FAIL')} | ${count(rows, 'NOT CHECKED')} | ${count(rows, 'FAIL', 'currentStatus')} | ${rows.filter(row => row.review?.tag === 'P').length} |`),
 `| Total | ${count(rows, 'PASS')} | ${count(rows, 'FAIL')} | ${count(rows, 'NOT CHECKED')} | ${count(rows, 'FAIL', 'currentStatus')} | ${rows.filter(row => row.review?.tag === 'P').length} |`, '',
 'P is a separate subjective review request, not a replacement for FAIL or NOT CHECKED. Numeric and observable clauses remain objective work. Full values and receipts are in [the generated acceptance reports](../fix51-verify/README.md).', '',
 '## Work and verification', '',
 ...(state.work ?? []).map(value => `- ${value}`), '',
 ...(state.gates.length ? ['| Check | Result | Evidence |', '|---|---|---|', ...state.gates.map(gate => `| ${text(gate.command)} | ${text(gate.result)} | ${gate.evidence ? `[receipt](${gate.evidence})` : '—'} |`), ''] : []),
 ...(physical ? ['## Physical desktop coverage', '',
  'Headless ordinary WASD/mouse routes, survival protection enabled, no objective skips, desktop 1280×720/DPR1, zoom1.5. This qualifies completion/console coverage; it does not qualify mortal balance or all visual rows. [Runtime backend/tier checks, receipt hashes and all advisories](physical-coverage.json).', '',
  '| Level | WebGL2 low | WebGL2 high | WebGPU low | WebGPU high |', '|---|---|---|---|---|',
  ...levels.map(level => `| ${level} | ${['webgl2', 'webgpu'].flatMap(backend => ['low', 'high'].map(tier => physical.rows.find(row => row.level === level && row.backend === backend && row.tier === tier)?.status ?? 'NOT CHECKED')).join(' | ')} |`), '',
  ...physical.rows.filter(row => row.status === 'FAIL').map(row => `- **${row.level}/${row.backend}/${row.tier} — FAIL.** ${text(row.blockingGameplayIssues?.at(-1)?.text ?? row.errors?.join('; ') ?? 'Incomplete physical coverage')} Next: ${physicalNext(row)}`), '',
  ...physical.rows.filter(row => row.advisories?.length).map(row => `- ${row.level}/${row.backend}/${row.tier}: ${row.advisories.length} driver advisories (${[...new Set(row.advisories.map(issue => issue.kind))].join(', ')}). Retain as open diagnosis; completion and zero console errors do not dismiss them.`), ''] : []),
 ...(perf ? ['## Quiet L4 performance versus PROD 0c410e111', '',
  'One cold context and one warm menu load per build; one continuous 60-second native hold route per build/cell, without captures. Exclusive quiet-run admission. [Build identities](builds.json), [quiet admission](quiet.jsonl), [measurements and exact pass rules](perf-summary.json). Single samples, not load percentiles.', '',
  '| Backend / tier | PROD cold / warm s | Candidate cold / warm s | p95 ms PROD → candidate | Max ms PROD → candidate | Result |', '|---|---:|---:|---:|---:|---|',
  ...perf.rows.map(row => `| ${row.backend} / ${row.tier} | ${row.prodLoadSeconds?.map(n => n.toFixed(3)).join(' / ') ?? 'missing'} | ${row.candidateLoadSeconds?.map(n => n.toFixed(3)).join(' / ') ?? 'missing'} | ${row.prodP95?.toFixed(1)} → ${row.candidateP95?.toFixed(1)} | ${row.prodMax?.toFixed(1)} → ${row.candidateMax?.toFixed(1)} | ${row.status} |`), ''] : []),
 '## Remaining lane actions', '', ...state.remainingLaneActions.map(value => `- ${value}`), '',
 '## Every remaining FAIL and NOT CHECKED row', '',
];
for (const [scope, scoped] of scopes) {
 const open = scoped.filter(row => row.status === 'FAIL' || row.status === 'NOT CHECKED');
 if (!open.length) continue;
 const report = scope === 'Global' ? 'global' : scope;
 lines.push(`### ${scope}`, '', `[Full criteria, values and receipts](../fix51-verify/${report}.json).`, '');
 for (const row of open) {
  const failures = row.checks.filter(check => check.status === 'FAIL');
  const measured = failures.length ? failures.slice(0, 3).map(check => `${check.level ?? scope}/${check.tier}/${check.policy}: ${check.clause} = ${short(check.value, 150)}`).join('; ') + (failures.length > 3 ? `; ${failures.length - 3} more failing clauses in JSON` : '')
   : row.historical?.status === 'FAIL' ? `Prior FAIL remains open: ${short(row.historical.value)}. Current measured clauses: ${row.currentStatus}.`
   : row.checks.length ? `${row.checks.length} measured clauses; the complete criterion is not yet qualified.` : short(row.value);
  lines.push(`- **${row.id} — ${row.status}.** ${measured} Next: ${text(next[row.id] ?? row.remaining).replace(/^NEXT:\s*/, '')}`);
 }
 lines.push('');
}
lines.push('## P — exact PO review requests', '');
for (const row of rows.filter(row => row.review?.tag === 'P')) lines.push(`- **${row.id} — P.** ${text(row.review.instruction)}`);
lines.push('', '## Proven observer correction and rejected game trials', '',
 '- [Starting-cell proof](start-cell-proof.json): the old L1 path result was false although a 9.33 m continuous path cleared the full 0.35 m body radius inside the unchanged 23.27 m limit. The corrected query includes the starting cell centre. The native final state remains `deb3bfd1`. Reproduce with `node --import tsx/esm tools/qa/accept/start-cell-proof.ts`.',
 '- [Close self-defence trial](l3-self-defence-rejected.json) and [lateral formation trial](l3-lateral-rejected.json) worsened mortal route outcomes and did not meet the officer share target. Both game changes were reverted.',
 '- [Admission trial](l3-admission-trial.json) retains every authored pending entry while testing a guard against repeatedly admitting retired-area residents. Its outcomes are diagnostic; no candidate result is used as an acceptance pass.', '',
 'No push or deployment was performed. Earlier sandbox failures are superseded by the actual runs documented above; they are not current blockers.', '');
writeFileSync(`${root}/README.md`, lines.join('\n'));
console.log(`Wrote ${rows.length} status rows, ${rows.filter(row => row.status !== 'PASS').length} open rows and ${rows.filter(row => row.review).length} P requests.`);
