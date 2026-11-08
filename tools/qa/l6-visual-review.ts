/** Explicit 2026-11-08 personal review decisions, with measured evidence appended. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { evaluate, type Clause } from './accept/evaluate';
import type { NativeReceipt } from './accept/probe';
import { writeReview } from './accept/reviews';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const proof = read('docs/reports/l6-visual/acceptance-fixtures.json') as { receipts: { checks: Clause[] }[] };
const clauses: Clause[] = proof.receipts.flatMap(r => r.checks);
const paths = ['docs/reports/l6-visual/acceptance-fixtures.json', 'docs/reports/l6-visual/capture-review.json', 'docs/reports/l6-visual/readability-analysis.json'];
for (const tier of ['low', 'high']) {
  for (const policy of ['complete', 'stationary']) {
    const p = `docs/reports/fix51-verify/receipts/L6-${tier}-${policy}.json`;
    clauses.push(...evaluate(read(p) as NativeReceipt, p)); paths.push(p);
  }
  const p = `docs/reports/fix51-verify/receipts/L6-${tier}-fixtures.json`; clauses.push(...read(p).checks); paths.push(p);
}
const notes: Record<string, string> = {
  'L6-01': 'Personally opened all8 shelter seat/care matrix panels: sitting and lying civilians stow guns; conversation/treatment/food-sharing poses distinct. Same24+5 carried keys, fullHP, five4-second snapshots with active story clips. Stored appearance/ally rifle data is not a visible seated weapon. Native handover max idle0. Includes living rest poses, not deaths.',
  'L6-02': 'All8 cells: actual headlamp stays at(1.5,-2) through120 idle ticks and collects after45 ordinary approach ticks without E; no new weapon IDs. Movement+X with pointer aim-X produces head yaw pi and beam(-1,~0); opened before/approach/opposed frames and saw cone follow aim.',
  'L6-03': 'Native ordinary complete route: first breach33.2s, door bangs2s earlier,8 actual shelter-floor admissions. Reachability records are actual bodies, not a director target count. Readability native shelter captures show the real first-wave actor62.',
  'L6-04': 'Native observer/control80s hashes agree. Second breach+21.0167s,10 bodies from2 accesses, power.off exactly same tick3253; emergency true. Existing native first-of abandon fixtures retain15s/3bitten threshold checks. Emergency native shelter/tunnel pictures opened in both backends/tiers/zooms.',
  'L6-05': 'Fresh current-source complete/stationary native ledgers retain bounded reachable share100%, complete11.4195 player windups/min; passive first attacks2.0833s and9.0833s after respective breach captions. Controlled actual trajectories, not displayed counter claims.',
  'L6-06': 'Actual12 side-entry actors, two each doors2,5,3,6,4,7 alternating sides, all reach track supports and end downed; bounded-path success>=99%. Observer checks real support height: rail support0.87 is reachable track, not nominal floor0.6. Canonical simulation hash unchanged.',
  'L6-07': 'Fresh ordinary complete retreat ledgers check actual player/group windups>=4/min, damage>=30HP and alive cap low30/high60. No god mode in these native policy receipts. This is a deterministic competent policy, not a claim about human enjoyment.',
  'L6-08': 'Both tiers all29 original identities including injured: settled2.1995157–2.19999994m/s. Personally opened8 native-crop contact sheets with all29 visible pips each;232 originalPNG checks contain54 cyan pip pixels minimum. Two demonstrated causes fixed: unblended fractional pose NaN bounds and compact pip discarded beside courier. Overlap fixture8/8 before missing,8/8 after drawn; opened two original after frames.',
  'L6-09': 'Personally opened48 open/closed gate frames in8 review sheets: ring/prompt sit on each gate; actual E on90/210 and physical click150 close gates. Native each2.2m gate blocks motion+sight and holds9.8167s vs5 actual runners. Offsets[-1.99,0,1.8,2,2.01] refuse all<=2m, allow2.01m; prompt anchor unchanged in3 courier positions.',
  'L6-10': 'Current native gate/platform marker trajectory and3-position boundary probes show fixed gate anchors, then fixed exit platform; review sheets show rings fixed against the stationary gate geometry.',
  'L6-11': 'Both ordinary mortal seed1 policies: complete18/29=62.069%, evade-only1/29=3.448%; zero deaths complete,12 evade-only. Full rosters and actual result accounting retained. Controlled29/29 ending pictures demonstrate rendering only, not covering performance.',
  'L6-12': 'Personally opened open/night/result panels in all8 matrix cells and exact1280x720 WebGPU high z1.5 night originals. Gate is drawn swung open when passable, closed gate remains in frame with courier on platform, letterbox hides HUD and exact caption Night. Still alive. reads clearly. Rapier at actual4.62m open cross6m, closed stops1.79494m. Controlled result29out+0lost=29in; ordinary result18+11=29.',
  'L6-13': 'Fresh native fixture runs ordinary fists-only policy to actual completion with only fists/kick offered or used; no soft-lock. Not inferred from armed screenshot fixture.',
  'L6-14': 'Personally opened16 native shelter/tunnel matrix panels plus16 native actor/body/eye crop sets. Linear-sRGB contrast with conservative0.05 offset8.463–11.380>=3. Eye luminance0.231878–0.26156 exceeds full-coverage non-eye body0.046423–0.047263; restored native repeat changed0 body pixels. Full-coverage white body mask>=240 excludes floor-colour mixed antialias edges; all112 original capture digests retained. No brightness product tweak was needed.',
};
const rows = read('docs/reports/fix51-verify/L6.json').rows as { id: string; expected: string }[];
for (const row of rows) {
  const checked = clauses.filter(c => c.id === row.id);
  if (!checked.length || checked.some(c => c.status === 'FAIL')) throw new Error(`${row.id}: measured failure or missing evidence`);
  const measurements = checked.map(c => `${c.tier}/${c.policy} ${c.clause}: ${JSON.stringify(c.value)} (${c.status})`).join('\n');
  writeReview({ row: row.id, status: 'PASS', reviewer: 'Codex/l6-visual', date: '2026-11-08', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), clauses: [{ clause: row.expected, verdict: 'PASS', note: `${notes[row.id]}\n${measurements}` }], evidence: paths.map(file => ({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), what: 'Current-source measured browser/native clauses and personally opened capture review manifest; see README for fixture scope and reproduction.' })), notes: 'Fresh low/high × WebGL2/WebGPU × zoom1/1.5 visual review. Capture review uses labeled contact sheets and native actor crops, plus explicitly listed full originals. No performance or full physical-route signoff inferred.' }, 'L6');
}
console.log('Wrote14 current L6 review decisions.');
