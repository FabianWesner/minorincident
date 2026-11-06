import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Hashed = { file: string; sha256: string };
type Bus = { id: number; hp: number; hidden: boolean; position: { x: number; z: number } };
type Departure = { phase: string; busId: number; startedAt: number; boarded: number[] };
type Sample = { tick: number; bus: Bus; departure: Departure };
type Input = {
  sourceHash: string; browserHash: string; toolSha256: string; seed: Hashed;
  setup: { quality: string; backend: string; driverDetached: boolean; incomingIds: number[] };
  result: { ticks: Sample[]; finish: Sample; inputs: { tick: number; nativeDriver: boolean }[] };
  commands: { keys: string[]; mouseDown: boolean }[];
  captures: (Hashed & { label: string; zoom: number; state: { tick: number } })[];
  errors: string[];
};
type Review = {
  sourceHash: string; browserHash: string; inputSha256: string;
  captures: (Hashed & { seen: string })[];
  visuals: { clause: string; pass: boolean; note: string }[];
  allPersonallyReviewed: boolean;
};
const root = 'docs/reports/sweep-c6/L7-11';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const visualClauses = ['burning skyline shrinks', 'military truck lit', 'gore reads as blood', 'no map edge in end shot'];

/** The uninterrupted physical ledger establishes time and movement; reviewed frames establish the four visual clauses. */
export function l7DepartureReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const rows = [];
  for (const tier of ['low', 'high'] as const) {
    const inputPath = `${root}/${tier}-physical.json.gz`, reviewPath = `${root}/${tier}-review.json`;
    if (!existsSync(inputPath) || !existsSync(reviewPath)) continue;
    const raw = gunzipSync(readFileSync(inputPath)), a = JSON.parse(raw.toString()) as Input;
    const v = JSON.parse(readFileSync(reviewPath, 'utf8')) as Review;
    if (a.sourceHash !== sourceHash || a.browserHash !== browserHash || a.toolSha256 !== sha(readFileSync(`${root}/${tier}-producer.mjs`)) ||
      v.sourceHash !== sourceHash || v.browserHash !== browserHash || v.inputSha256 !== sha(raw)) continue;
    if (!a.result.finish) continue;
    const finish = a.result.finish, start = finish.departure.startedAt;
    const ticks = a.result.ticks.filter(t => t.departure.phase === 'departing');
    const first = ticks[0], last = ticks.at(-1), seconds = (finish.tick - start) / 60;
    const displacement = first ? Math.hypot(finish.bus.position.x - first.bus.position.x, finish.bus.position.z - first.bus.position.z) : 0;
    const consecutive = !!first && !!last && first.tick >= start && first.tick <= start + 1 && last.tick >= finish.tick - 1 &&
      ticks.every((t, i) => t.tick === first.tick + i);
    const sameBus = !!first && ticks.every(t => t.bus.id === first.bus.id && t.departure.busId === first.bus.id && t.bus.hp > 0 && !t.bus.hidden) &&
      finish.bus.id === first.bus.id && finish.departure.busId === first.bus.id && finish.bus.hp > 0;
    // The physical driver advances three ticks per call. Once completion stops the world,
    // remaining device samples in that call can share the final tick.
    const physical = a.setup.driverDetached && a.result.inputs.length >= finish.tick && a.result.inputs.length <= finish.tick + 2 &&
      a.result.inputs.every((f, i) => f.tick === Math.min(i, finish.tick) && !f.nativeDriver) && a.commands.some(c => c.keys.length > 0) &&
      existsSync(a.seed.file) && sha(readFileSync(a.seed.file)) === a.seed.sha256;
    const valid = a.setup.quality === tier && a.setup.backend === 'webgl' && !a.errors.length;
    const labels = Array.from({ length: 18 }, (_, i) => `departure-${i / 2}`);
    const cinematic = a.captures.filter(c => c.label.startsWith('departure-'));
    const coverage = cinematic.length === labels.length && labels.every((label, i) => a.captures.some(c =>
      c.label === label && c.zoom === 1.5 && Math.abs(c.state.tick - start - i * 30) <= 3));
    const seen = v.allPersonallyReviewed && v.captures.length === a.captures.length && a.captures.every(c =>
      v.captures.some(r => r.file === c.file && r.sha256 === c.sha256 && r.seen.trim()) && evidenceIsArchivedOrMatches(c.file, c.sha256));
    const visuals = visualClauses.every(clause => v.visuals.some(c => c.clause === clause && c.pass && c.note.trim()));
    const path = `${reportRoot}/receipts/L7-${tier}-departure-browser.json`;
    const receipt: FixtureReceipt = {
      version: 1, level: 'L7', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], observations: { root },
      checks: [
        { id: 'L7-11', clause: 'continuous physical departure duration and bus displacement', tier, policy: 'physical-departure',
          status: valid && physical && consecutive && sameBus && seconds >= 6 && seconds <= 10 && displacement >= 30 && finish.departure.phase === 'done' ? 'PASS' : 'FAIL',
          value: { valid, physical, consecutive, sameBus, seconds, displacement, firstTick: first?.tick, lastTick: last?.tick, finishTick: finish.tick, busId: finish.bus.id },
          target: 'Physical WASD/mouse from actual progressed save; no native driver ticks; full consecutive departure ledger, same live bus, 6–10 seconds and ≥30 metres.', receipt: inputPath },
        { id: 'L7-11', clause: 'reviewed complete cinematic visual strip', tier, policy: 'physical-departure',
          status: valid && coverage && seen && visuals ? 'PASS' : 'FAIL', value: { coverage, seen, visuals: v.visuals, captures: a.captures.length },
          target: 'Personally reviewed half-second strip from 0 through8.5s, each actual frame digest linked to input. Burning skyline shrinks, military truck lit, blood readable, no map edge in end shot.', receipt: reviewPath },
      ],
    };
    atomicJson(path, receipt); rows.push({ path, receipt });
  }
  return rows;
}
