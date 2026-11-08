import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { RunnerLevel } from '../../sim-runner/levels';
import { completeNativeRows, evaluate, type Clause, type Verdict } from './evaluate';
import type { NativeReceipt } from './probe';
import type { FixtureReceipt } from './fixtures';
import { latestRelevantCommit, loadReviews, reviewFreshness, validateReviewDirectory, type ReviewDecision } from './reviews';

export const reportRoot = 'docs/reports/fix51-verify';
type BaselineRow = { id: string; level: string; status: Verdict; value: string; evidence: string[]; method: string };
interface SourceRow { id: string; level: string; expected: string; check: string; baseline: BaselineRow }
export interface AcceptanceRow {
  id: string; status: Verdict; currentStatus: Verdict; value: string; receipt: string[];
  automatedComplete: boolean;
  expected: string; checks: Clause[]; historical: BaselineRow; remaining: string;
  review?: { tag: 'O' | 'P'; instruction: string; clause?: string };
  reviewDecision?: ReviewDecision & { freshness: 'FRESH' | 'STALE'; latestRelevantCommit: string };
  performanceRemeasurement?: { id: string; scopedVerdict: string; wholeRowVerdict: string; value: string; remaining: string; sourceRevision: string; receipt: string; freshness: 'CURRENT' | 'STALE'; measuredSourceHash: string; criteriaSha256: string };
}
export interface LevelAcceptance {
  version: 2; level: RunnerLevel; sourceHash: string; observerHash: string; generatedAt: string;
  fixtureHash?: string;
  checkpointHash?: string;
  policies: { tier: string; policy: string; outcome: string | null; error: string | null; receipt: string }[];
  globals: AcceptanceRow[]; rows: AcceptanceRow[];
}
export function atomicJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n'); renameSync(`${path}.tmp`, path);
}
export function sourceRows(): SourceRow[] {
  const baseline = JSON.parse(readFileSync('docs/reports/batch51-qa/criteria.json', 'utf8')) as { rows: BaselineRow[] };
  const rows: SourceRow[] = [];
  for (const line of readFileSync('docs/qa/level-acceptance.md', 'utf8').split('\n')) {
    const cells = line.split('|').map(cell => cell.trim()), id = cells[1];
    if (!/^(?:G-\d{2}|L\d+-\d{2})$/.test(id ?? '')) continue;
    const old = baseline.rows.find(row => row.id === id);
    if (!old) throw new Error(`Missing historical criterion: ${id}`);
    rows.push({ id, level: old.level, expected: cells[id.startsWith('G-') ? 2 : 3], check: cells.at(-2)!, baseline: old });
  }
  if (rows.length !== 169 || new Set(rows.map(row => row.id)).size !== 169) throw new Error('Acceptance source inventory changed; reconcile all IDs');
  return rows;
}
const subjectiveReview: Record<string, string> = {
  'L4-11': 'PO: does firing at a riot infected feel effective? Review the perceived hit feedback only; HP chips, recoil, TTK, bars and the full-health duel retain objective checks.',
  'L5-05': 'PO: can a competent player still just walk, pick up the survivors and walk away? Review perceived rescue pressure only; reachability, route density, attack rate and first-attack clock retain numeric checks.',
  'L4-18': 'PO: do the war frames read as a huge mixed war? Use the reviewed battle captures; player readability remains an objective inspection.',
  'L5-14': 'PO: do matched L4/L5 views read as the same place, fallen? Sun intensity reduction remains a numeric clause.',
  'L7-12': 'PO: does L7 read as the worst destruction so far, and do Alpha silhouettes read as human? Use the separately listed quantitative matrix result for player contrast≥3:1.',
};
function concise(value: unknown): string {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  return rendered.length > 400 ? `${rendered.slice(0, 400)}… (full values in JSON)` : rendered;
}
const remainingChecks: Record<string, string> = {
  'G-05': 'Quiet-window renderer/sim/heap budget matrix at each peak; current native receipts qualify only infected counts.',
  'G-08': 'Compare HUD arrow, distance and ring with each real destination; distinguish fixed-gate handoffs and Mega intro from player-following markers.',
  'G-10': 'Run the16-cell moving-input pickup fixture at both qualities, including the authored L6 headlamp, and retain native route distance checks.',
  'G-11': 'Inspect survivor-only pickup rings; revisit collected locations to qualify no respawn beyond the native duplicate/removal probes.',
  'G-12': 'Render and inspect all35 following health bars simultaneously; production eligibility/cap is measured, pixels remain open.',
  'G-13': 'Fix measured individual pace failures; measure exact player waiting with one follower>10m behind (current waiting value is only an upper bound).',
  'G-19': 'Inspect no corgi HP bar, geometry/hull clearance and inside-door/shutter placement; native target/damage/health samples are measured.',
  'G-20': 'Trigger final-objective completion during ongoing action in every level; qualify five-second invulnerable run-out on each edge.',
  'G-21': 'Requalify cited snapshot mismatches after owning lanes fix them; native cases already exercise naturally reached later checkpoints and restore locations.',
  'G-22': 'Fix cited no-contact/late attack cohorts; add bounded paths and validate every announced threat against its actual announcement clock.',
  'G-24': 'Render eligibility transitions for Alpha and all infected zoo species; current fixture qualifies production eligibility, not world-space bar pixels.',
  'G-25': 'Complete physical WASD/mouse playthroughs at both qualities for all10 levels; native completion is not browser console qualification.',
  'L1-01': 'Native mission completion/no-deadline/start-arsenal clauses are fully measured at both qualities.',
  'L1-02': 'Requalify high-quality civilian count after fix; inspect sidewalk routines and player visibility separately.',
  'L1-06': 'Inspect native Annex exit stream timing/directions on screen; IDs and technician-first ordering are measured.',
  'L1-13': 'Fix the measured native fist/bat hit counts (10/3 versus6–7/2), then rerun both qualities.',
  'L2-01': 'Inspect exact four seated positions on two benches; native alarm/crew clocks and calm combat counts are measured.',
  'L2-02': 'Actual no-axe pickup avoidance and completion are measured; inspect the rack ring from the game camera.',
  'L2-03': 'Inspect visible crew/courier overlap; native ride seating and clocks are measured.',
  'L2-05': 'Inspect panic bang/press/plead loops behind glass; native first-exit clock is measured.',
  'L2-06': 'Fix cited low-tier ambush count; measure direction angular separation and first visible admission rather than authored door count.',
  'L2-08': 'Fix measured idle snowball/turned-firefighter shortfall; rerun idle full120s contact windows at both qualities.',
  'L2-09': 'Requalify the separately labelled uninterrupted +10/+90s census; count-only protection cannot establish mortality. Retain the15m route qualification and independent mortal death trial.',
  'L2-15': 'Inspect police light bars and visible officer firing; gate timing/crossing and prepared officer/civilian identities are measured.',
  'L3-01': 'Fire600 real handgun shots and inspect reload/ammo UI; native acquisition clock and two-hit40HP fixture are measured.',
  'L3-02': 'Make tagged yard-cover arrivals visibly clear the truck within2s; qualify actual rendered bodies, not frustum membership. Preserve five directions, wave totals and20% station-door police census. See fix63-a cover sheet.',
  'L3-04': 'Retain the exact first-of threshold ledger; qualify a natural same-ID uniformed officer conversion before fallback at both qualities.',
  'L3-06': 'Moving fire is implemented and reviewed at zoom1.5 low/high. Fix low3–6m follow failures and obtain high calm survivors while retaining at most2 at army; two tighter-controller trials regressed attrition and were reverted. See fix63-a.',
  'L3-07': 'Measure squad gun hits from formation through segment1, including the yard retreat; kills are not required. Retain player damage for the entire same window and review visible firing. See fix64-a.',
  'L3-08': 'Fix segment population/density failures; retain distinction between authored pending slots and actual live concurrent entities.',
  'L3-11': 'Fix cited competent attack-rate failure; native medkit census and mortal newbie low-health share are now measured.',
  'L3-12': 'Inspect HUD real-destination distance and route readability; native l3-zone marker coordinates are fixed.',
  'L3-16': 'Review current smoke counterexamples, then recapture all three streets at both zooms/qualities after a game fix. Light and distinct damage remain PO review; smoke count stays objective.',
  'L4-09': 'Native line/fallback clocks and isolated production camera duration/skip gates are measured at both qualities.',
  'L4-11': 'Inspect visible HP chip/recoil and always-shown riot bar; add mortal full-health continuous-fire duel. Isolated frontal/flank TTK is measured.',
  'L4-16': 'Isolated uninterrupted bar timing is measured; inspect entry roster, low-pass audibility and same-basement L5 handover.',
  'L5-05': 'Reachability/contact clauses are measured; qualify competent route density≥1 infected per40m. Perceived rescue pressure is a separate PO question.',
  'L5-08': 'PO95%/2s checker is wired and boundary-proved. Low followers31/32/28 reach92.12/89.22/85.26% in band and fail; high passes band tolerance. Combat pace and every visible bar remain unqualified. No L5 game change in fix63-a.',
  'L6-08': 'Qualify2.2m/s group and injured-follower speed in controlled walks; inspect every bar. Individual route pace ratios are measured.',
  'L6-13': 'Both mortal unarmed completion/evade attempts time out after repeated deaths; diagnose policy versus game soft-lock before asserting FAIL.',
  'L7-01': 'Inspect approach collection; perform pickup/first-shot frame gate only in orchestrator quiet window. Exit distance is measured.',
  'L8-06': 'The fresh low/high complete breach-phase ledgers record 3.49/3.11 player-plus-group windups per minute against the unchanged 4/min target. Investigate route pressure if small and understood; otherwise retain this measured FAIL. Stationary clocks and reachability also remain part of the row.',
  'L7-09': 'Inspect all bars and pressing-crowd body orientation; retain the measured individual human pace checks.',
  'L9-07': 'Fix wreck-objective-before-impact ordering; qualify zero-durability crash and inspect whole APC fall without floating wheels.',
  'L10-03': 'Fix measured regional peak bounds; qualify simultaneous species counts and group sizes. Peak bounds exclude at most one Mega.',
  'L10-04': 'Fix measured regional no-contact/low attack rates, then rerun both qualities on ordinary completion routes.',
};
export function rowResult(source: SourceRow, checks: Clause[]): AcceptanceRow {
  const objectiveReviews: Record<string, string> = {
    'L6-01': source.expected,
    'L6-02': source.expected,
    'L6-04': source.expected,
    'L6-06': source.expected,
    'L6-08': source.expected,
    'L6-09': source.expected,
    'L6-11': source.expected,
    'L6-12': source.expected,
    'L6-14': source.expected,

    'L4-15': source.expected,
    'L4-02': source.expected,
    'L4-08': source.expected,
    'G-11': source.expected,
    'G-12': source.expected,
    'G-24': source.expected,
    'L7-01': source.expected,
    'L7-08': source.expected,
    'L10-08': source.expected,
    'L10-03': source.expected,
    'L10-12': source.expected,
    'L10-14': source.expected,
    'L7-06': source.expected,
    'L7-11': source.expected,
    'L8-04': source.expected,
    'L8-03': source.expected,
    'L8-10': source.expected,
    'L8-09': source.expected,
    'L8-08': source.expected,
    'L8-07': source.expected,
    'L9-01': source.expected,
    'L9-02': source.expected,
    'L9-06': source.expected,
    'L9-05': source.expected,
    'L9-07': source.expected,
    'L10-07': source.expected, // Personally reviewed minimap frames supplement pursuit and actual audio graph checks.
    'L10-05': source.expected, // Physical pickup approaches supplement native transaction controls.
    'L1-02': source.expected,
    'L1-04': source.expected,
    'L1-03': 'Inspect the continuous same-actor depot handover, walk back through the shop door and door closure in both qualities.',
    'L1-06': source.expected,
    'L1-10': source.expected,
    'L1-11': source.expected,
    'L1-12': source.expected,
    'L1-14': source.expected,
    'L1-15': source.expected,
    'L3-01': source.expected,
    'L3-10': source.expected,
    'L3-05': source.expected,
    'L3-14': source.expected,
    'L3-15': source.expected,
    'L2-01': 'Inspect four civilians seated on two benches in the current low/high opening frames; clocks and calm combat remain native checks.',
    'L2-03': 'Inspect crew and courier visibility during boarding, ride and market arrival in both qualities; opaque engine occlusion is an objective failure.',
    'L2-02': 'Inspect the rack ring clear of the sign and bollards from the game camera in low/high; no-axe completion remains a native check.',
    'L2-05': source.expected,
    'L2-06': source.expected,
    'L2-13': source.expected,
    'L3-07': source.expected,
    'L3-06': source.expected,
    'L3-02': source.expected,
    'L2-11': source.expected,
    'L3-13': source.expected,
    'L3-12': source.expected,
    'L1-16': source.expected,
    'L2-14': source.expected,
    'L2-15': source.expected,
  };
  const scopedReviews: Record<string, string | null> = {
    'G-13': null,
    'G-15': null,
    'L6-07': null,
    'L10-14': source.expected,
    'G-27': 'For each level, judge whether it looks stunning and list any boring, harmless or babysitting moments. Glitches remain objective defects to list separately.',
    'L1-17': 'Review the morning depot/Annex frames for an inhabited suburb, then the outbreak frames for the feeling that there are too many infected to fight.',
    'L2-16': 'Compare L1 and L2 at matching zoom and quality: does L2 sunlight read higher/harder, and do the streets look wounded while buildings still stand?',
    'L3-16': 'Review Boulevard, Commerce and Oak frames at both zooms/qualities: does the light read late afternoon, and does each street communicate its distinct damage? The required two smoke columns per frame remain an objective check.',
  };
  const objectiveReview = objectiveReviews[source.id];
  const review = objectiveReview ?? (source.id in scopedReviews ? scopedReviews[source.id] : /\bP\b/.test(source.check) || ['G-27', 'L2-16', 'L3-16', 'L5-11', 'L5-14'].includes(source.id) ? (subjectiveReview[source.id] ?? source.expected.replaceAll('**', '')) : null);
  const reviewClause = objectiveReview || source.id === 'L5-11' ? source.expected : undefined;
  const failed = checks.filter(check => check.status === 'FAIL');
  const required = completeNativeRows.get(source.id);
  const complete = !!required && ['low', 'high'].every(tier => required.every(requirement => checks.some(check => check.tier === tier && check.policy === requirement.policy && (!requirement.level || check.level === requirement.level) && check.clause === requirement.clause && check.status === 'PASS'))) && checks.every(check => check.status !== 'FAIL');
  const decision = loadReviews(source.id);
  // Display review provenance on plain numeric rows too. The existing native
  // completion and exact-criterion gates below still determine qualification.
  const reviewCheck = decision;
  const freshness = reviewCheck ? reviewFreshness(reviewCheck, source.level) : undefined;
  const matchingReview = reviewClause ? reviewCheck?.clauses.find(clause => clause.clause === reviewClause) : undefined;
  const allReviewPass = !reviewClause || (!!reviewCheck && !!matchingReview && freshness === 'FRESH' && reviewCheck.status === 'PASS' && matchingReview.verdict === 'PASS');
  const reviewFailed = !!reviewCheck && freshness === 'FRESH' && (reviewCheck.status === 'FAIL' || reviewCheck.clauses.some(clause => clause.verdict === 'FAIL'));
  // An older/manual decision can remain useful as history without qualifying a
  // changed exact criterion. Keep the row open rather than aborting the whole
  // acceptance report; matching text is still required for a reviewed PASS.
  const currentStatus: Verdict = failed.length || reviewFailed ? 'FAIL' : complete && allReviewPass ? 'PASS' : 'NOT CHECKED';
  // A prior failure needs both complete current measurements and an explicit
  // fresh review of the entire unchanged criterion before it can close.
  const requalified = source.baseline.status === 'FAIL' && currentStatus === 'PASS' && freshness === 'FRESH' && reviewCheck?.status === 'PASS' &&
    reviewCheck.clauses.some(clause => clause.clause === source.expected && clause.verdict === 'PASS');
  const status = source.baseline.status === 'FAIL' && !requalified ? 'FAIL' : currentStatus === 'NOT CHECKED' && source.baseline.status === 'PASS' ? 'PASS' : currentStatus;
  const display = failed.length ? failed : checks;
  const measurement = display.map(check => `${check.tier}/${check.policy} ${check.clause}: ${concise(check.value)} (target ${check.target}; ${check.status})`).join('; ');
  const historical = source.baseline.status === 'FAIL' ? `${requalified ? 'Requalified' : 'Open'} prior FAIL: ${source.baseline.value}` : !checks.length ? source.baseline.value : '';
  const reviewed = reviewCheck ? `Manual review ${reviewCheck.status} (${freshness}, ${reviewCheck.reviewer}): ${reviewCheck.clauses.map(clause => clause.note ?? clause.clause).join('; ')}` : '';
  const remaining = requalified ? 'All required current clauses pass; fresh exact-criterion review closes the prior finding. Historical evidence is retained.' : complete ? 'All implemented row clauses measured at both qualities; prior PO findings still need PO closure.' : remainingChecks[source.id] ?? source.baseline.method;
  return {
    id: source.id, status, currentStatus, value: [measurement, reviewed, historical].filter(Boolean).join(' '),
    automatedComplete: complete,
    receipt: [...new Set([...checks.map(check => check.receipt), ...(reviewCheck?.evidence.map(evidence => evidence.file) ?? []), ...(source.baseline.status !== 'NOT CHECKED' ? source.baseline.evidence : [])])],
    expected: source.expected, checks, historical: source.baseline,
    remaining: !failed.length && /^(?:Fix|Requalify .*after .*fix)/i.test(remaining)
      ? `Finish the unmeasured clauses of the source criterion; current measured clauses have no fresh FAIL. Required: ${source.expected}` : remaining,
    ...(review ? { review: { tag: objectiveReview ? 'O' as const : 'P' as const, instruction: review, ...(reviewClause ? { clause: reviewClause } : {}) } } : {}),
    ...(reviewCheck && freshness ? { reviewDecision: { ...reviewCheck, freshness, latestRelevantCommit: latestRelevantCommit(source.level) } } : {}),
  };
}
export function buildLevelReport(level: RunnerLevel, receipts: { path: string; receipt: NativeReceipt }[], fixtures: { path: string; receipt: FixtureReceipt }[] = [], checkpointHash?: string): LevelAcceptance {
  if (!receipts.length) throw new Error(`No current receipts for ${level}`);
  const fixtureGroup = (path: string) => path.endsWith('-browser.json') ? 2 : path.endsWith('-checkpoints.json') ? 1 : 0;
  fixtures = [...fixtures].sort((a, b) => fixtureGroup(a.path) - fixtureGroup(b.path) || (a.receipt.tier === b.receipt.tier ? a.path.localeCompare(b.path) : a.receipt.tier === 'low' ? -1 : 1));
  const identity = receipts[0].receipt;
  if (receipts.some(item => item.receipt.level !== level || item.receipt.sourceHash !== identity.sourceHash || item.receipt.observerHash !== identity.observerHash)) throw new Error('Mixed native receipt provenance');
  const sources = sourceRows(), checks = [...receipts.flatMap(item => evaluate(item.receipt, item.path)), ...fixtures.flatMap(item => item.receipt.checks.map(check => ({ ...check, level: item.receipt.level })))];
  const build = (source: SourceRow) => rowResult(source, checks.filter(check => check.id === source.id));
  return { version: 2, level, sourceHash: identity.sourceHash, observerHash: identity.observerHash, fixtureHash: fixtures[0]?.receipt.fixtureHash, checkpointHash, generatedAt: new Date().toISOString(),
    policies: [...receipts.map(item => ({ tier: item.receipt.tier, policy: item.receipt.policy, outcome: item.receipt.run?.outcome ?? null, error: item.receipt.error, receipt: item.path })), ...fixtures.map(item => ({ tier: item.receipt.tier, policy: item.path.endsWith('-browser.json') ? item.receipt.checks.find(check => check.id === 'G-25')?.policy ?? 'real-input-browser' : item.path.endsWith('-checkpoints.json') ? 'checkpoint-death-control' : 'controlled-fixtures', outcome: item.receipt.errors.length ? 'fixture-error' : item.path.endsWith('-browser.json') && item.receipt.checks.some(check => check.status !== 'PASS') ? 'incomplete' : 'complete', error: item.receipt.errors.length ? item.receipt.errors.join('; ') : null, receipt: item.path }))],
    globals: sources.filter(source => source.level === 'global').map(build), rows: sources.filter(source => source.level === level).map(build) };
}
const clean = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const countStatuses = (rows: AcceptanceRow[]) => rows.reduce<Record<string, number>>((result, row) => { result[row.status] = (result[row.status] ?? 0) + 1; return result; }, {});

/** perf2 measured this exact game-source hash, retained by its merge e851b81cd.
 * These scoped receipts never qualify a whole compound row or erase prior FAILs. */
export function attachPerformanceRemeasurements(rows: AcceptanceRow[], sourceHash: string): AcceptanceRow[] {
  const path = 'docs/reports/fix51-perf2/criteria.json';
  const data = readFileSync(path);
  const measuredSourceHash = '710a965e75362a3a634730b032b1d68d1f840cb9dd52f4d6fd039fa9dfeb0a23';
  const criteria = JSON.parse(data.toString()) as { rows: Omit<NonNullable<AcceptanceRow['performanceRemeasurement']>, 'freshness' | 'measuredSourceHash' | 'criteriaSha256'>[] };
  return rows.map(row => {
    const measurement = criteria.rows.find(item => item.id === row.id);
    if (!measurement) return row;
    const freshness = sourceHash === measuredSourceHash ? 'CURRENT' : 'STALE';
    return { ...row,
      value: `fix51-perf2 scoped ${measurement.scopedVerdict} (${freshness}): ${measurement.value} Whole row ${row.currentStatus}. ${row.value}`,
      receipt: [...new Set([...row.receipt, path, measurement.receipt])],
      remaining: `${measurement.remaining} ${row.remaining}`,
      performanceRemeasurement: { ...measurement, freshness, measuredSourceHash, criteriaSha256: createHash('sha256').update(data).digest('hex') },
    };
  });
}

/** Merge only reports from the same game/observer; keep historical findings attributed. */
export function writeIndexes(identity: { sourceHash: string; observerHash: string; fixtureHash?: string; checkpointHash?: string }): void {
  validateReviewDirectory();
  const reports = Array.from({ length: 10 }, (_, i) => join(reportRoot, `L${i + 1}.json`)).filter(existsSync).map(path => JSON.parse(readFileSync(path, 'utf8')) as LevelAcceptance)
    .filter(report => report.version === 2 && report.sourceHash === identity.sourceHash && report.observerHash === identity.observerHash && report.fixtureHash === identity.fixtureHash && report.checkpointHash === identity.checkpointHash);
  const sources = sourceRows(), globals = attachPerformanceRemeasurements(sources.filter(source => source.level === 'global').map(source => rowResult(source, reports.flatMap(report => report.globals.find(row => row.id === source.id)?.checks ?? []))), identity.sourceHash);
  atomicJson(join(reportRoot, 'global.json'), { ...identity, generatedAt: new Date().toISOString(), levels: reports.map(report => report.level), rows: globals });
  const allRows = sources.map(source => source.level === 'global' ? globals.find(row => row.id === source.id)! : reports.find(report => report.level === source.level)?.rows.find(row => row.id === source.id) ?? rowResult(source, []));
  const counts = countStatuses(allRows), measured = allRows.filter(row => row.checks.some(check => check.status !== 'NOT CHECKED')), failures = allRows.filter(row => row.currentStatus === 'FAIL');
  const nativeRuns = reports.reduce((n, report) => n + report.policies.filter(policy => policy.policy === 'complete' || policy.policy === 'stationary').length, 0);
  const controls = reports.reduce((n, report) => n + report.policies.filter(policy => policy.receipt.endsWith('-checkpoints.json')).length, 0);
  const checkpointCases = reports.reduce((n, report) => n + (report.globals.find(row => row.id === 'G-21')?.checks.length ?? 0), 0);
  const browserRuns = reports.reduce((n, report) => n + report.policies.filter(policy => policy.receipt.endsWith('-browser.json')).length, 0);
  const freshPasses = allRows.filter(row => row.currentStatus === 'PASS').map(row => row.id);
  const inheritedPasses = allRows.filter(row => row.status === 'PASS' && row.currentStatus !== 'PASS').map(row => row.id);
  const top = `# Acceptance status — fix51-verify\n\n**NO-GO.** NOT CHECKED is not a pass. Targets remain unchanged in [level-acceptance.md](level-acceptance.md). Native receipts identify exact source hashes and policies. Browser, timing and review clauses remain open. Prior FAILs stay open until their full row is requalified on current source and a fresh exact-criterion PASS review closes the finding.\n\nMachine reports: [fix51-verify](../reports/fix51-verify/README.md). Historical observations: [batch51](../reports/batch51-qa/criteria.json).\n\nStatus counts: ${Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(', ')}. Current clause measurements cover ${measured.length}/169 rows; ${failures.length} have fresh failing clauses.\n\n`;
  const table = (rows: AcceptanceRow[]) => '| ID | Status | Measured value / gap | Receipt | Remaining / PO review |\n|---|---|---|---|---|\n' + rows.map(row => `| ${row.id} | ${row.status} | ${clean(row.value)} | ${row.receipt.map(path => `[JSON](../../${path})`).join(', ') || '—'} | ${clean(row.remaining)}${row.review ? ` ${row.review.tag}${row.reviewDecision ? ` ${row.reviewDecision.freshness}` : ''}: ${clean(row.review.instruction)}` : ''} |`).join('\n');
  const sections = ['global', ...Array.from({ length: 10 }, (_, i) => `L${i + 1}`)].map(level => `## ${level}\n\n${table(allRows.filter(row => level === 'global' ? row.id.startsWith('G-') : row.id.startsWith(`${level}-`)))}\n`);
  const reviewQueue = ['global', ...Array.from({ length: 10 }, (_, i) => `L${i + 1}`)].map(level => {
    const queued = allRows.filter(row => (level === 'global' ? row.id.startsWith('G-') : row.id.startsWith(`${level}-`)) && !!row.review?.clause && row.automatedComplete && row.currentStatus === 'NOT CHECKED');
    return `### ${level}\n\n${queued.length ? queued.map(row => `- **${row.id}:** ${clean(row.expected)}`).join('\n') : 'No rows currently have all automated clauses passing with only the review clause outstanding.'}`;
  }).join('\n\n');
  writeFileSync('docs/qa/acceptance-status.md', top + sections.join('\n') + `\n\n## Review queue\n\nRows listed here have passing measured automated clauses and need only their manual review clause. Stale decisions remain NOT CHECKED until reviewed against current level/render source.\n\n${reviewQueue}\n`);
  const summary = `# fix51-verify acceptance automation\n\n**NO-GO; incomplete acceptance coverage.** ${measured.length}/169 rows have current measured clauses; ${failures.length} have fresh FAILs. Status totals: ${Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(', ')}. Passing a subset never closes a compound row. The brief's three-hour time box leaves the explicit open items below.\n\n## Run\n\nRun \`npm run qa:accept -- --level L1\` (L1–L10), or \`--level all\`. The default includes low/high native completion and stationary observations, controlled mechanics and edge cases, checkpoint deaths with an uninstrumented control, and headless physical WASD/mouse WebGL2 playthroughs. Global clauses are evaluated before each level's clauses. \`--skip-browser\` runs only native stages and preserves matching prior browser receipts; missing physical coverage remains open. \`--reuse\` requires matching source and stage hashes. \`--tier low|high\` and \`--policy complete|stationary\` narrow a diagnostic run and cannot alone qualify both qualities. Reports update atomically. Exit1 means FAIL/error; exit2 means incomplete; exit0 means all reported rows qualify.\n\nThe command writes the level JSON, [global.json](global.json) and [acceptance tracker](../../qa/acceptance-status.md). Each row retains the unchanged absolute target, every clause's value/status, source and observer hashes, receipt paths, historical finding, and next check.\n\n## Scope and evidence\n\nCurrent receipts include ${nativeRuns} observed native routes, ${controls} uninstrumented control routes, ${checkpointCases} individual checkpoint deaths, and ${browserRuns} physical browser runs. Each physical receipt states its backend, tier, completion, console errors and ordinary-input coverage. Browser completion metadata is kept under [receipts](receipts); raw screenshots and profiles are deleted. The full desktop backend matrix and separate quiet performance results are summarized in [fix51-r4](../fix51-r4/README.md); phone/zoom/visual coverage remains open.\n\nFresh complete-row passes: ${freshPasses.join(', ') || 'none'}. Inherited historical passes: ${inheritedPasses.join(', ') || 'none'}; these are explicitly attributed, not new visual qualification. Prior FAILs without complete current requalification and a fresh full-row review remain open. G-16 requires all20 level/quality starts, including exactly axe in L10; a 19/20 matrix cannot pass.\n\n[Audit](audit.json) rebuilds every row, checks all169 IDs, source/target immutability, receipt provenance and missing files. [Control proof](control-proof.json) compares full final native state hashes with the ${controls} uninstrumented runs. [Evaluator proof](evaluator-proof.json) injects bad receipts and tests compound/global coverage. [Fault proof](fault-proof.json) exercises process-local broken production mechanics, then restores them without editing game source. Final repository gates are recorded in [validation.json](validation.json). These tools are separate from the registered unit-test budget.\n\nNo performance timings are collected. G-01 through G-05 timing clauses require the orchestrator quiet window; G-05 native population is only a count clause. Native checks cannot qualify rendered bars, shadows, silhouettes, camera framing, audio audibility or route clarity. L2 no-axe completion is measured independently of the rack visibility review. L6 fists-only mortal attempts that time out remain inconclusive. L3 pending population slots are reported separately from live concurrent entities. L10 regional peak bounds allow one Mega and do not certify species/group composition.\n\nCheckpoint cases deliberately dirty live racks, gates, pickup membership and follower health before mortal death. L1/L4 world-preserving retries and L8 expose snapshot mismatches; locations restore correctly. These controlled mismatches are scoped evidence, not a claim that an ordinary input run loses its arsenal. L10 cases additionally perturb cure ownership and boss HP/death before retry. Stationary policies are labelled survival-protected and cannot establish mortal difficulty; L9's no-fire policy continues driving.\n\n## Reports\n\n| Level | Report | Policies |\n|---|---|---|\n` + reports.map(report => `| ${report.level} | [${report.level}.json](${report.level}.json) | ${report.policies.map(policy => `[${policy.tier}/${policy.policy}](${policy.receipt.replace(`${reportRoot}/`, '')})`).join(', ')} |`).join('\n') +
    '\n\n## Open items\n\nEvery remaining row and next check is listed here. P preserves the exact PO-review scene/behavior; quantitative clauses in those rows remain automated work.\n\n| ID | Status | Current clauses | Remaining / PO review |\n|---|---|---|---|\n' + allRows.filter(row => row.currentStatus !== 'PASS').map(row => `| ${row.id} | ${row.status} | ${row.checks.length} | ${clean(row.remaining)}${row.review ? ` ${row.review.tag}: ${clean(row.review.instruction)}` : ''} |`).join('\n') + '\n';
  writeFileSync(join(reportRoot, 'README.md'), summary);
}
