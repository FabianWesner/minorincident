/** Run the existing QA driver's policy from an immutable campaign save; audit reads never steer it.
 * node --import tsx tools/qa/softlocks-1101-run.ts l2|l8 <seed profile> <origin> [count]
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { runSession } from '../playtest/session';

interface Row {
  tick: number; at: number; player: { x: number; z: number; hidden: boolean };
  l2?: { phase: string; rideS: number; arrivedAt: number; invariant: boolean };
  l8?: { passengers: { id: number; hp: number; companion: boolean; phase: string | null }[] };
}
const [mode, seedProfile, origin, countArg] = process.argv.slice(2);
assert(mode === 'l2' || mode === 'l8', 'mode must be l2 or l8');
assert(seedProfile && origin, 'seed profile and preview origin required');
const count = Number(countArg ?? (mode === 'l2' ? 5 : 3));
const root = resolve(process.env.SOFTLOCK_AUDIT_OUT ?? `test-results/softlocks-1101/${mode}`), source = resolve(seedProfile, 'pool-storage.json');
mkdirSync(root, { recursive: true });
const seedHash = createHash('sha256').update(readFileSync(source)).digest('hex');
process.env.PLAYTEST_SOFTLOCK_AUDIT = '1';
process.env.PLAYTEST_BACKEND ??= 'webgpu';
const summaries: object[] = [];
for (let i = 1; i <= count; i++) {
  const out = resolve(root, `run-${i}`), profile = resolve(out, 'profile'), tag = `${mode}-${i}`;
  rmSync(profile, { recursive: true, force: true }); mkdirSync(profile, { recursive: true });
  const storage = JSON.parse(readFileSync(source, 'utf8')) as { origins: { origin: string }[] };
  // Ports isolate preview builds; migrate the unchanged game save to the target
  // preview origin, as a browser otherwise treats it as an unrelated game.
  for (const saved of storage.origins) if (['127.0.0.1', 'localhost'].includes(new URL(saved.origin).hostname)) saved.origin = origin;
  writeFileSync(resolve(profile, 'pool-storage.json'), JSON.stringify(storage));
  const result = await runSession({ origin, out, profile, levels: [mode.toUpperCase()], quality: 'low', zoom: 1.5, heroine: 'female',
    entry: 'continue', levelMinutes: 8, stopAfterLevel: true, noSkip: true, sampleSeconds: Number(process.env.SOFTLOCK_SAMPLE_SECONDS ?? (mode === 'l2' ? 60 : 420)), tag });
  const rows = JSON.parse(readFileSync(resolve(out, `${tag}-softlocks.json`), 'utf8')) as Row[];
  const completion = JSON.parse(readFileSync(resolve(out, `${tag}-completion.json`), 'utf8')) as { campaign: { transport?: { occupants: { id: number }[] }; results?: Record<string, { escapedSurvivors?: { id: number }[] }> } };
  let summary: object;
  if (mode === 'l2') {
    const samples = rows.filter(r => r.l2), arrived = samples.some(r => r.l2!.arrivedAt > 0);
    const violations = samples.filter(r => r.l2!.invariant).length;
    let pinStart = 0, maxPinMs = 0;
    for (const r of samples) {
      if (!r.player.hidden && r.l2!.phase === 'alarm' && r.player.x > -71.2 && r.player.x < -69.5 && r.player.z > 37 && r.player.z < 40.2) {
        pinStart ||= r.at; maxPinMs = Math.max(maxPinMs, r.at - pinStart);
      } else pinStart = 0;
    }
    summary = { run: i, seedHash, arrived, maxRideS: Math.max(0, ...samples.map(r => r.l2!.rideS)), hiddenBoardedViolations: violations, reportedPinSeconds: maxPinMs / 1000 };
    summaries.push(summary); writeFileSync(resolve(root, 'summary.json'), JSON.stringify(summaries, null, 2)); console.log(JSON.stringify(summary));
    assert(arrived, 'Engine 3 must depart and reach Grove Market'); assert.equal(violations, 0, 'hidden player must be boarded'); assert(maxPinMs < 3000, 'reported station approach must not pin the player');
  } else {
    const last = rows.filter(r => r.l8).at(-1)?.l8;
    const payload = completion.campaign.transport?.occupants ?? [];
    const escaped = completion.campaign.results?.L8?.escapedSurvivors ?? [];
    const aboardIds = new Set([...payload, ...escaped].map(e => e.id));
    const living = last?.passengers.filter(p => p.hp > 0) ?? [];
    const allBoarded = living.length > 0 && living.every(p => aboardIds.has(p.id));
    const finished = result.runs.some(r => r.level === 'L8' && r.finished && !r.skipped.length);
    summary = { run: i, seedHash, finished, lastLiving: living.length, allBoarded, carriedIds: [...aboardIds] };
    summaries.push(summary); writeFileSync(resolve(root, 'summary.json'), JSON.stringify(summaries, null, 2)); console.log(JSON.stringify(summary));
    assert(finished && allBoarded, 'all living passengers must board and continue to L9');
  }
}
